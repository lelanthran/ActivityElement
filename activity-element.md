# ActivityElement Documentation

## Purpose

`ActivityElement` is a custom HTML element designed to manage "remote activities"-self-contained HTML/JavaScript modules loaded dynamically at runtime. Each activity has a well-defined lifecycle and supports controlled interactions (complete, cancel, fail). This abstraction enables modular, user-driven workflows without hard-coding logic into the main application.

## Example Usage

### Activity Module (`activity-test.actv`)

```html
<!-- activity-test.actv -->
<div>
  <p>Please enter your name:</p>
  <input id="nameInput" type="text" />
  <button id="okBtn">OK</button>
  <button id="cancelBtn">Cancel</button>
  <button id="failBtn">Fail</button>
</div>

<script>
exports.onCreate = function(activity, intent) {
  const root = activity.root;
  const input = root.querySelector('#nameInput');
  const okBtn = root.querySelector('#okBtn');
  const cancelBtn = root.querySelector('#cancelBtn');
  const failBtn = root.querySelector('#failBtn');

  okBtn.addEventListener('click', () => {
    const name = input.value.trim();
    if (name) {
      activity.finish({ name });
    } else {
      alert('Please enter your name');
    }
  });

  cancelBtn.addEventListener('click', () => {
    activity.cancel('User cancelled');
  });

  failBtn.addEventListener('click', () => {
    activity.fail('User failed');
  });

  input.value = JSON.stringify(activity.params);
};

exports.onCancel = function () {
  console.log('Activity was cancelled externally');
};
</script>
```

### Main HTML File

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ActivityElement Demo</title>
  <script src="activity-element.js"></script>
</head>
<body>
  <button id="start">Start Activity</button>
  <div id="container"></div>

  <script>
    ActivityElement.intentRegister('askName', document.body, 'activity-test.actv');

    document.getElementById('start').onclick = async () => {
      const activity = await ActivityElement.intentStart('askName', { userId: 42 });
      const result = await activity.result;
      console.log("Status:", result.status);
      if (result.status === 'completed') console.log("Name:", result.value.name);
      if (result.status === 'cancelled') console.log("Cancelled:", result.reason);
    };
  </script>
</body>
</html>
```

## Public API Reference

### `ActivityElement.intentRegister(intentName, container, source)`

Registers an activity intent.

- **intentName**: `string` - Unique name for this activity.
- **container**: `HTMLElement` - DOM element where the activity will be rendered.
- **source**: `string | Object` - Remote URL or a lifecycle object with `onCreate`, `onDestroy`, etc.

---

### `ActivityElement.intentStart(intentName, params = {}, options = {})`

Starts a registered activity.

- **intentName**: `string` - Registered activity identifier.
- **params**: `Object` - Parameters to pass to the activity (default `{}`).
- **options**: `Object`
  - `container`: `HTMLElement` - Override the default container.
- **Returns**: `Promise<Object>` resolving to:
  - `element`: `ActivityElement`
  - `result`: `Promise<{ status, value?, reason?, error? }>`
  - `cancel(reason)`: Cancel function
  - `state()`: Returns current lifecycle state

---

### `element.finish(value)`

Marks the activity as successfully completed.

- **value**: `any` - Result returned to caller.

---

### `element.cancel(reason)`

Cancels the activity.

- **reason**: `string` - Optional reason for cancellation.

---

### `element.fail(error)`

Fails the activity.

- **error**: `Error | string` - Failure reason.

---

### `element.result`

Promise resolving when the activity ends.

- **Returns**: `Promise<{ status, value?, reason?, error? }>`

---

### `element.state`

Returns the activity's current lifecycle state.

- `'pending'`
- `'completed'`
- `'cancelled'`
- `'failed'`
