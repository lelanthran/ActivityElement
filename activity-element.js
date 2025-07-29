/**
 * A custom HTML element that manages remote activities with lifecycle control.
 * Activities are remote HTML/JavaScript components that can be launched, controlled,
 * and cleaned up dynamically.
 *
 * @extends HTMLElement
 */
class ActivityElement extends HTMLElement {
   /**
    * Registry mapping intent names to their remote source URLs.
    * @type {Map<string, string>}
    * @private
    * @static
    */
   static _intentRegistry = new Map();

   /**
    * Registers an intent with its remote source URL for later launching.
    *
    * @param {string} intentName - Unique identifier for the intent
    * @param {string} remoteSrc - URL to fetch the activity HTML/JavaScript from
    * @static
    */
   static registerIntent(intentName, remoteSrc) {
      ActivityElement._intentRegistry.set(intentName, remoteSrc);
   }

   /**
    * Launches a registered activity intent and returns a promise that resolves
    * to an activity control object.
    *
    * @param {string} intentName - The name of the registered intent to launch
    * @param {Object} [params={}] - Parameters to pass to the activity
    * @param {Object} [options={}] - Launch options
    * @param {HTMLElement} [options.container=document.body] - Container element for the activity
    * @returns {Promise<Object>} Promise resolving to:
    *   - element: The ActivityElement instance
    *   - result: Promise resolving to activity completion result
    *   - cancel: Function to cancel the activity
    *   - state: Function returning current state
    * @throws {Error} When no activity is registered for the given intent name
    * @static
    */
   static intentStart(intentName, params = {}, options = {}) {
      const remoteSrc = ActivityElement._intentRegistry.get(intentName);
      if (!remoteSrc) {
         throw new Error(`No activity registered for intent: ${intentName}`);
      }

      const container = options.container || document.body;
      const element = document.createElement('activity-element');
      container.appendChild(element);

      return element._launch(remoteSrc, params, options);
   }

   /**
    * Creates a new ActivityElement instance.
    * Initializes the activity state and sets up the result promise.
    */
   constructor() {
      super();
      this._state = 'pending'; // 'pending' | 'completed' | 'cancelled' | 'failed'
      this._onCancelHandlers = [];

      this._activity = {
         root: this,
         state: () => this._state,
         finish: (value) => this.finish(value),
         cancel: (reason) => this.cancel(reason),
         fail: (error) => this.fail(error),
         onCancel: (fn) => {
            if (typeof fn === 'function') this._onCancelHandlers.push(fn);
         },
         params: "",
      };

      // Create deferred promise
      let _resolve, _reject;
      this.result = new Promise((resolve, reject) => {
         _resolve = resolve;
         _reject = reject;
      });
      this._resolve = (value) => {
         if (this._state !== 'pending')
            return;
         this._state = 'completed';
         this._safeCall(() => this._exports?.onDestroy?.(this._activity));
         _resolve({
            status: 'completed',
            value
         });
         this._teardown();
      };
      this._reject = (error) => {
         if (this._state !== 'pending') return;
         this._state = 'failed';
         this._safeCall(() => this._exports?.onDestroy?.(this._activity));
         _reject({
            status: 'failed',
            error: error instanceof Error ? error : new Error(String(error))
         });
         this._teardown();
      };
      this._cancelResolve = (reason) => {
         if (this._state !== 'pending') return;
         this._state = 'cancelled';
         this._safeCall(() => this._exports?.onDestroy?.(this._activity));
         _resolve({ status: 'cancelled', reason });
         this._teardown();
      };
   }

   /**
    * Promise that resolves when the activity completes, fails, or is cancelled.
    * @type {Promise<Object>} Promise resolving to:
    *   - status: 'completed' | 'cancelled' | 'failed'
    *   - value: Return value when completed
    *   - error: Error object when failed
    *   - reason: Cancellation reason when cancelled
    */
   result;

   /**
    * Launches the activity by fetching and executing remote content.
    *
    * @param {string} remoteSrc - URL to fetch the activity from
    * @param {Object} [params={}] - Parameters to pass to the activity
    * @param {Object} [options={}] - Launch options
    * @returns {Promise<Object>} Promise resolving to activity control object
    * @throws {Error} When activity is already launched or fetch fails
    * @private
    */
   _launch(remoteSrc, params = {}, options = {}) {
      if (this._state !== 'pending') {
         throw new Error('Activity already launched or finished');
      }
      this._activity.params = params;
      return fetch (remoteSrc).then((response) => {
         if (!response.ok) {
            throw new Error(`Fetch: ${remoteSrc}: ${response.status} ${response.statusText}`);
         }
         return response.text();
      }).then((htmlText) => {
         const tempDiv = document.createElement('div');
         tempDiv.innerHTML = htmlText;

         this._exports = this._extractAndExecuteScripts(tempDiv);

         // Append all remaining nodes to this element (root)
         Array.from(tempDiv.children).forEach((child) => this.appendChild(child));

         if (typeof this._exports.onCreate === 'function') {
            this._exports.onCreate(this._activity, params);
         }
         return {
            element: this,
            result: this.result,
            cancel: (reason) => this.cancel(reason),
            state: () => this.state
         };
      }).catch((error) => {
         this.fail(error);
      });
   }

   /**
    * Cancels the activity with an optional reason.
    * Triggers all registered cancel handlers and resolves the result promise
    * with cancelled status.
    *
    * @param {string} [reason='cancelled'] - Reason for cancellation
    */
   cancel(reason) {
      try {
         this._onCancelHandlers.forEach((fn) => fn(reason));
      } catch {}
      this._cancelResolve(reason || 'cancelled');
   }

   /**
    * Completes the activity successfully with the given value.
    * Resolves the result promise with completed status.
    *
    * @param {*} value - The value to return as the activity result
    */
   finish(value) {
      this._resolve(value);
   }

   /**
    * Fails the activity with the given error.
    * Rejects the result promise with failed status.
    *
    * @param {Error|string} error - The error that caused the failure
    */
   fail(error) {
      this._reject(error);
   }

   /**
    * Cleans up the activity by removing it from DOM and clearing handlers.
    *
    * @private
    */
   _teardown() {
      // Clean up DOM and handlers
      if (this.parentNode) this.parentNode.removeChild(this);
      this._onCancelHandlers = [];
   }

   /**
    * Extracts and executes script tags from the fetched HTML fragment.
    *
    * @param {DocumentFragment} fragment - HTML fragment containing scripts
    * @returns {Object} Exported objects from the executed scripts
    * @private
    */
   _extractAndExecuteScripts(fragment) {
      const scripts = fragment.querySelectorAll('script');
      let scriptContent = '';
      scripts.forEach((script) => {
         scriptContent += script.textContent + '\n';
         script.remove();
      });
      return this._executeInClosure(scriptContent);
   }

   /**
    * Executes JavaScript code in a closure with exports and activity context.
    *
    * @param {string} scriptContent - JavaScript code to execute
    * @returns {Object} Exported objects from the executed code
    * @private
    */
   _executeInClosure(scriptContent) {
      try {
         const closureFunction = new Function('exports', 'activity', `
        (function () {
          try {
            ${scriptContent}
          } catch (error) {
            console.error("Runtime error in ActivityElement script:", error);
            activity.fail(error);
          }
        })();
        return exports;
      `);
         const exportsObj = {};
         return closureFunction(exportsObj, this._activity) || exportsObj;
      } catch (error) {
         console.error("Syntax error in activity script:", error);
         this.fail(error);
         return {};
      }
   }

   /**
    * Safely calls a function, ignoring any thrown errors.
    *
    * @param {Function} fn - Function to call safely
    * @private
    */
   _safeCall(fn) {
      try {
         fn();
      } catch {}
   }

   /**
    * Gets the current state of the activity.
    *
    * @returns {'pending'|'completed'|'cancelled'|'failed'} The current activity state
    */
   get state() {
      return this._state;
   }

}

// Register the custom element
customElements.define('activity-element', ActivityElement);
