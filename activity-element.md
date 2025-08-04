# ActivityElement Documentation

## Purpose

`ActivityElement` is a custom HTML element designed to manage "remote
activities" which are self-contained HTML/JavaScript bundles loaded
dynamically at runtime. Each activity has a well-defined lifecycle and
supports controlled interactions (complete, cancel, fail). This abstraction
enables modular, user-driven workflows without hard-coding logic into the main
application.

In plain language: you define a workflow, that can call other workflows which
return a result, which your workflow can then use. You can also:

1. Call other workflows in non-blocking mode (use `.then()` to retrieve the
result).
2. Call other workflows in blocking mode (use `await` for the result).
3. Specify which HTML element should serve as a container for the called
workflow.
4. Specify a default HTML element to be used for any workflow started for a
specific `Intent` (more about `Intent`s below).
5. Write your own workflow using a fragment of HTML and methods scoped to the
single instance of that fragment, like a normal object.

> Specifying the containing HTML element allows the caller to, on one HTML
> page, put the activity `myact.actv` into a div on the page, and in another
> HTML page put the activity `myact.actv` into a dialog. It's very flexible.

Each workflow should be a self-contained sub-program that will return a value
which the caller will get via a `Promise`. This sub-program is started by an
event. The events are called **Intents** and the workflows/sub-programs are
called **Activities**.

# How it works

The general idea is to facilitate designing workflows, which can be started as
non-blocking sub-programs (just start them) or as blocking subprograms that
return a value (`await` on them).

The nouns (`Activity` and `Intent`) are chosen to mimic the Android
application architecture, but they are very different.

A developer creates an `Activity` which will be served as a static file
download by the webserver. I use the file extension `.actv` and I set my code
editors to all identify that as an HTML file.

The `.actv` file contains a snippet of HTML and some lifecycle functions. The
caller registers `Intent`s along with the URL to the `.actv` file that must be
launched when that `Intent` is started with a call to
`Activity.intentStart()`.

When an `Intent` is started/launched, the `.actv` file that was registered for
that `Intent` is downloaded, the HTML fragment within the `.actv` file is
inserted into the DOM and the Javascript object that is created contains the
lifecycle methods for that instance.

The example will probably clarify things better than I can. Note that there
are two examples in this repo; the [workflow.html](./tests/workflow.html) one
is probably a more realistic view of how this would look in a sufficiently
complex workflow.

## Example Usage

Enough explanations; an example is a better explanation anyway.

### Activity Module (`activity-test.actv`)

This is an example implementation of an `Activity`. it's a very simple one
(see the `tests/` directory in this repo for more involved examples).

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

This is the example HTML file that uses the above activity. The caller needs
to only use `intentRegister()` and `intentStart()` to use the activity. The
activity can return a value (and does, in this example) via a promise.

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
