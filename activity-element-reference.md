# ActivityElement Documentation

## Overview

`ActivityElement` is a custom HTML element that provides a framework for
loading and managing remote activities dynamically. It allows you to register
intent-based activities, launch them with parameters, and manage their
lifecycle with proper state management and cleanup.

## Features

- **Intent-based Activity Registration**: Register activities with intent
  names mapped to remote sources
- **Dynamic Loading**: Fetch and execute remote HTML/JavaScript content
- **Lifecycle Management**: Complete activity lifecycle with proper state
  transitions
- **Promise-based API**: Asynchronous operations with Promise support
- **Cancellation Support**: Built-in cancellation mechanism with custom
  handlers
- **Automatic Cleanup**: DOM and memory cleanup when activities complete

## Class Definition

```javascript
class ActivityElement extends HTMLElement
```

## Static Properties

### `_intentRegistry`
```javascript
static _intentRegistry = new Map();
```
Internal registry mapping intent names to remote source URLs.

## Static Methods

### `registerIntent(intentName, remoteSrc)`
Registers an activity intent with its corresponding remote source.

**Parameters:**
- `intentName` (string): Unique identifier for the intent
- `remoteSrc` (string): URL of the remote activity source

**Example:**
```javascript
ActivityElement.registerIntent('user-profile', 'https://example.com/activities/user-profile.actv');
```

### `intentStart(intentName, params = {}, options = {})`
Launches an activity by intent name.

**Parameters:**
- `intentName` (string): Name of the registered intent
- `params` (object): Parameters to pass to the activity
- `options` (object): Launch options
  - `container` (HTMLElement): Container element (defaults to `document.body`)

**Returns:**
Promise resolving to an object containing:
- `element` (HTMLElement): The activity element instance
- `result` (Promise): Promise that resolves when activity completes
- `cancel` (function): Function to cancel the activity
- `state` (function): Function to get current state

**Throws:**
- Error if intent is not registered

**Example:**
```javascript
const activity = await ActivityElement.intentStart('user-profile', 
  { userId: 123 }, 
  { container: document.getElementById('main') }
);
```

## Instance Properties

### `_state`
```javascript
_state = 'pending'
```
Current state of the activity. Possible values:
- `'pending'`: Activity is running
- `'completed'`: Activity finished successfully
- `'cancelled'`: Activity was cancelled
- `'failed'`: Activity failed with an error

### `_activity`
Internal activity object exposed to remote scripts containing:
- `root`: Reference to the ActivityElement instance
- `state()`: Function returning current state
- `finish(value)`: Function to complete the activity
- `cancel(reason)`: Function to cancel the activity
- `fail(error)`: Function to fail the activity
- `onCancel(fn)`: Function to register cancellation handlers
- `params`: Parameters passed to the activity

### `result`
```javascript
result: Promise
```
Promise that resolves when the activity completes, cancels, or fails.

## Instance Methods

### `constructor()`
Initializes the ActivityElement with default state and
sets up the activity object and result promise.

### `launch(remoteSrc, params = {}, options = {})`
Launches an activity from a remote source.

**Parameters:**
- `remoteSrc` (string): URL of the remote activity
- `params` (object): Parameters to pass to the activity
- `options` (object): Launch options

**Returns:**
Promise resolving to launch result object

**Process:**
1. Fetches remote HTML content
2. Extracts and executes JavaScript
3. Appends HTML content to the element
4. Calls `onCreate` if defined in remote script

### `cancel(reason)`
Cancels the activity with an optional reason.

**Parameters:**
- `reason` (string): Optional cancellation reason

**Behavior:**
- Calls all registered cancel handlers
- Transitions state to 'cancelled'
- Resolves result promise with cancellation status

### `finish(value)`
Completes the activity successfully with a return value.

**Parameters:**
- `value` (any): Value to return from the activity

**Behavior:**
- Transitions state to 'completed'
- Resolves result promise with completion status and value

### `fail(error)`
Fails the activity with an error.

**Parameters:**
- `error` (Error|string): Error that caused the failure

**Behavior:**
- Transitions state to 'failed'
- Rejects result promise with error status

### `state` (getter)
Returns the current state of the activity.

**Returns:**
String representing current state ('pending', 'completed', 'cancelled',
'failed')

## Remote Activity Interface

Remote activities loaded by ActivityElement should follow this interface:

### Expected Exports

#### `onCreate(activity, params)`
Called when the activity is first loaded.

**Parameters:**
- `activity`: Activity object with helper methods
- `params`: Parameters passed during launch

#### `onDestroy(activity)`
Called when the activity is being destroyed (optional).

**Parameters:**
- `activity`: Activity object

### Activity Object Methods

Within remote activities, use the `activity` object to interact with the
lifecycle:

```javascript
// Complete the activity
activity.finish({ result: 'success' });

// Cancel the activity
activity.cancel('user requested');

// Fail the activity
activity.fail(new Error('Something went wrong'));

// Register cancellation handler
activity.onCancel((reason) => {
  console.log('Activity cancelled:', reason);
});

// Get current state
const state = activity.state();
```

## Usage Examples

### Basic Intent Registration and Launch

```javascript
// Register an intent
ActivityElement.registerIntent('calculator', '/activities/calculator.actv');

// Launch the activity
try {
  const launch = await ActivityElement.intentStart('calculator', {
    initialValue: 0
  });
  
  // Wait for completion
  const result = await launch.result;
  
  if (result.status === 'completed') {
    console.log('Calculator result:', result.value);
  } else if (result.status === 'cancelled') {
    console.log('Calculator cancelled:', result.reason);
  }
} catch (error) {
  console.error('Activity failed:', error);
}
```

### Activity with Cancellation

```javascript
const launch = await ActivityElement.intentStart('long-task', { 
  duration: 30000 
});

// Cancel after 5 seconds
setTimeout(() => {
  launch.cancel('timeout');
}, 5000);

const result = await launch.result;
console.log('Task result:', result);
```

### Custom Container

```javascript
const container = document.getElementById('activity-container');
const launch = await ActivityElement.intentStart('form-builder', {
  fields: ['name', 'email']
}, { 
  container 
});
```

### Sample Remote Activity (calculator.actv)

```html
<div class="calculator">
  <input type="number" id="display" readonly>
  <div class="buttons">
    <button onclick="clearDisplay()">C</button>
    <button onclick="calculate()">=</button>
  </div>
</div>

<script>
let currentValue = 0;

exports.onCreate = function(activity, params) {
  currentValue = params.initialValue || 0;
  document.getElementById('display').value = currentValue;
  
  // Register cleanup handler
  activity.onCancel(() => {
    console.log('Calculator cancelled');
  });
};

exports.onDestroy = function(activity) {
  console.log('Calculator destroyed');
};

function clearDisplay() {
  currentValue = 0;
  document.getElementById('display').value = currentValue;
}

function calculate() {
  const result = currentValue * 2; // Simple calculation
  activity.finish({ calculation: result });
}
</script>
```

## API Reference

### Static Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `registerIntent` | `intentName`, `remoteSrc` | void | Registers an activity intent |
| `intentStart` | `intentName`, `params?`, `options?` | Promise\<LaunchResult\> | Launches an activity by intent |

### Instance Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `launch` | `remoteSrc`, `params?`, `options?` | Promise\<LaunchResult\> | Launches activity from remote source |
| `cancel` | `reason?` | void | Cancels the activity |
| `finish` | `value` | void | Completes the activity successfully |
| `fail` | `error` | void | Fails the activity with error |

### Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `state` | string | Current activity state |
| `result` | Promise | Promise resolving to activity result |

### Result Object Structure

```javascript
{
  status: 'completed' | 'cancelled' | 'failed' | 'pending',
  value?: any,      // Present when status is 'completed'
  error?: Error,    // Present when status is 'failed'
  reason?: string   // Present when status is 'cancelled'
}
```

### Launch Result Structure

```javascript
{
  element: ActivityElement,     // The activity element instance
  result: Promise<ResultObject>, // Promise resolving to result
  cancel: (reason?) => void,    // Function to cancel activity
  state: () => string          // Function to get current state
}
```

## Error Handling

The ActivityElement handles various error scenarios:

### Registration Errors
```javascript
// Throws if intent not found
ActivityElement.intentStart('unknown-intent'); // Error: No activity registered for intent: unknown-intent
```

### Network Errors
```javascript
// Fails if remote source cannot be fetched
const launch = await ActivityElement.intentStart('my-intent');
const result = await launch.result; // May reject with fetch error
```

### Script Errors
- Syntax errors in remote scripts are caught and cause activity failure
- Runtime errors in remote scripts are caught and cause activity failure
- Both are logged to console for debugging

## Best Practices

1. **Always handle errors**: Wrap activity launches in try-catch blocks
2. **Register intents early**: Register all intents before attempting to
   launch
3. **Use meaningful intent names**: Choose descriptive names for better
   maintainability
4. **Implement onDestroy**: Clean up resources in remote activities
5. **Handle cancellation**: Register cancel handlers for proper cleanup
6. **Validate parameters**: Check parameters in onCreate before using them

## Browser Compatibility

ActivityElement uses modern web APIs:
- Custom Elements (Web Components)
- Promises
- Fetch API
- ES6+ features

Ensure your target browsers support these features or include appropriate
polyfills.
