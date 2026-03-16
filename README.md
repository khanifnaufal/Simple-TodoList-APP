# ToDoListApp

A simple, modern to-do list web app with:

- Add tasks with label, priority, and optional due date/time.
- Mark tasks complete and delete tasks.
- Filter by all/active/done and search by text/label.
- Dark/light theme toggle with saved preference.
- Desktop notifications for tasks due in less than 1 hour (when granted).
- Data persisted in `localStorage`.

## How to run

1. Open `index.html` in your browser.
2. Add tasks in the input form and press "Tambah".
3. Use the filter buttons and search to find tasks.
4. Toggle theme using the light/dark button.

## Files

- `index.html` - app structure and markup
- `style.css` - styling and responsive layout
- `app.js` - app logic, state, rendering, and localStorage

## Notes

- Uses browser `localStorage` with keys:
  - `todolist.tasks.v1`
  - `todolist.theme.v1`
  - `todolist.dueNotified.v1`
- Notifications require permission and only show for tasks due within 1 hour.

Enjoy building and customizing your task tracker!
