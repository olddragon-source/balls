# Balls Game (JavaScript)

## Run Tests

```bash
npm test
```

## Development

`index.html` uses `type="module"` and loads `js/main.js`.

Start the development server:

```bash
npm start
```

Edit files inside `js/` and refresh the browser to see changes instantly.

## Windows PowerShell

If PowerShell blocks `npm` with an execution policy error, you can either:

```powershell
npm.cmd start
```

or allow local scripts for your user account:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then restart PowerShell and run:

```powershell
npm start
```

## Build for Portable / Offline Use

When you need a standalone version:

```bash
npm run compile
```

This generates `dist/` with:

- `game.bundle.js`
- `index.html`
- `css/`
- `balls/`
- `highscore.txt` if it exists

## Usage

Zip `dist/` to share with another PC or Android device, or open:

```text
dist/index.html
```

It also works via `file://` without a server.
