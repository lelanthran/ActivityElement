# ActivityElement Reference Manual

`ActivityElement` is a lightweight, framework-agnostic web component that
brings Android-style **Activity/Intent** patterns to HTML-based applications.
It allows for modular, asynchronous, and isolated activity fragments to be
dynamically loaded and executed.

---

## License and Ownership

This software is proprietary and exclusively owned by **Rundata Systems**. All
rights reserved.

---

## Overview

- Activities are standalone remote HTML fragments.
- Each Activity fragment contains a script with lifecycle hooks.
- `ActivityElement` is responsible for:
  - Fetching and loading activity fragments.
  - Executing associated scripts in isolated closures.
  - Passing in parameters.
  - Returning a structured result asynchronously.

---

## Activity Registration

```js
ActivityElement.registerActivity(intentName, remoteUrl);
```

Registers an Activity by name.

- `intentName` *(string)* — Symbolic name for the intent.
- `remoteUrl` *(string)* — URL/path to the `.actv` fragment file.

---

## Starting an Activity

```js
const activity = await ActivityElement.intentStart(intentName, params?, options?);
```

- `intentName` *(string)* — Name registered earlier via `registerActivity()`.
- `params` *(object)* — Optional parameters passed to the activity.
- `options` *(object)* — Optional config object:
- `container` *(HTMLElement)* — DOM element to insert the
  `<activity-element>` into. Defaults to `document.body`.

### Returns: `Activity` object (asynchronously)

```js
{
  element,     // the ActivityElement instance
  result,      // Promise<{ status: "completed" | "cancelled" | "failed", value?, reason? }>
  cancel(),    // function to cancel the activity
  state(),     // returns "pending", "completed", "cancelled", or "failed"
}
```

- `element` — The actual `<activity-element>` custom element.
- `result` — A promise resolving to a result object:

```js
{
  status: "completed" | "cancelled" | "failed",
  value?: any,      // Provided by the activity calling `finish()`
  reason?: any      // Provided by the activity calling `fail()` or reason for cancellation
}
```

---

## Activity Fragment Format (`.actv`)

An activity fragment is an HTML snippet that includes a `<script>` block with
lifecycle hooks attached to `this`.

### Example:

```html
<div>
  <h3>Enter your name</h3>
  <input type="text" id="nameInput" />
  <button id="ok">OK</button>
</div>

<script>
this.onCreate = function () {
  const input = this.querySelector('#nameInput');
  this.querySelector('#ok').onclick = () => {
    this.finish({ name: input.value });
  };
};
</script>
```

---

## Lifecycle Hooks

The activity script can define the following optional hooks:

- `onCreate()` — Called after the fragment is loaded and attached to the DOM.
- `onFinish()` — Called when the activity completes via `finish()`.
- `onCancel()` — Called if the activity is cancelled via `cancel()`.
- `onFail()` — Called when `fail(reason)` is called.

---

## Activity Methods (Inside Fragment Script)

### `this.finish(value)`

Completes the activity successfully. Triggers resolution of the `result`
promise.

### `this.fail(reason)`

Fails the activity. Triggers rejection of the `result` promise with `status:
"failed"`.

### `this.cancel()`

Cancels the activity (e.g., user presses "Cancel"). Triggers `status:
"cancelled"`.

### `this._params`

Object passed in from `intentStart()`.

---

## Activity State

Accessible via the `state()` method of the returned activity object:

- `"pending"` — Activity is running.
- `"completed"` — Finished successfully via `finish()`.
- `"cancelled"` — Cancelled by caller or internally.
- `"failed"` — Failed via `fail()`.

---

## Example Usage

```js
ActivityElement.registerActivity("askName", "/activity/sample.actv");

const activity = await ActivityElement.intentStart("askName", { greeting: "Hello" });

const { status, value, reason } = await activity.result;

if (status === "completed") {
  console.log("Name entered:", value.name);
} else if (status === "cancelled") {
  console.warn("Activity cancelled:", reason);
} else {
  console.error("Activity failed:", reason);
}
```

---

## Notes

- Multiple activities can be in flight at once.
- Activities are detached and cleaned up after completion/cancellation/failure.
- Avoid global state inside activities.
- Parameters are shallow-copied into `this._params`.

---

For any usage issues, contact Rundata Systems directly.

