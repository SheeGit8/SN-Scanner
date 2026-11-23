# Sheehan IT Stock Scanner

Scan or photograph the serial number label on IT equipment, and keep one shared stock list:
what each item is, who uses it, and where it is.

The list lives in a **Google Sheet**, which works as the app's database. Every phone and computer
reads and writes the same sheet, and people can also open the sheet and edit it directly.

```
Phone / PC ──app password──▶ Vercel /api/gas ──sync token──▶ Apps Script (code.gs) ──▶ Google Sheet + Drive
```

- **The app** (this repo) is hosted on Vercel. The camera needs a normal web page, so the app
  can't be served from inside Apps Script.
- **`api/gas.js`** is a small Vercel function. It checks the app password, then forwards the request
  to Apps Script with the secret sync token. The browser never sees the token or the script's URL.
- **`app-script/code.gs`** runs in Google Apps Script. It reads and writes the `Items` sheet, and
  stores label photos in a Drive folder.

## Setting it up

### 1. The Google Sheet and Apps Script

1. Create a Google Sheet, for example "IT Stock". Open **Extensions → Apps Script**.
2. Replace everything in `Code.gs` with the contents of [`app-script/code.gs`](app-script/code.gs), then save.
3. In the function list at the top, pick **`generateSyncToken`** and press **Run**. Approve the
   permissions Google asks for. Copy the token from the **Execution log**; you'll need it in step 2.
4. Pick **`setup`** and press **Run**. This creates the `Items` sheet (red header row) and the Drive
   folder **Sheehan IT Stock Photos**. Running it again is safe.
5. **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**,
   then **Deploy**. Copy the **Web app URL** (it ends in `/exec`).

"Anyone" is needed so the Vercel server can call the script without a Google sign-in. Requests
without the sync token are refused.

### 2. Vercel

In the Vercel project, go to **Settings → Environment Variables** and add:

| Name           | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| `GAS_URL`      | The Web app URL from step 1.5 (ends in `/exec`)                    |
| `SYNC_TOKEN`   | The token from step 1.3                                            |
| `APP_PASSWORD` | The app's login password. Use a long one                           |

Then redeploy. The variables are only read on the server. Don't give any of them a `VITE_` prefix,
because that would put them inside the web page for anyone to read.

### 3. Logging in

The app opens on a login screen that asks only for the password (`APP_PASSWORD`). There are no
user names: everyone on the team uses the same password. A device stays logged in until someone
taps **Log out** (the arrow icon at the bottom of the sidebar, also in the phone's menu).

Logging out forgets the password, the copy of the stock list and the downloaded photos on that
device. Changes that haven't reached the sheet yet are kept and saved after the next login there;
the app warns before logging out with such changes.

Scans saved in a browser before the sheet was connected are added to the sheet automatically the
first time that browser opens the connected app.

## How it behaves

- **Changes show at once and are saved in the background.** The sidebar (or the cloud icon in
  the phone's top bar) shows *Synced*, *Saving…*, *Offline · 3 waiting* or what went wrong.
  Tapping it retries.
- **Offline is fine while the app is open.** Changes wait on the device and are sent when the
  connection comes back, even if the tab was closed in between. (Opening the app from scratch
  still needs a connection.)
- **Other people's changes** appear within 45 seconds, or as soon as you come back to the app.
- **Editing the sheet directly** is fine. You can sort, filter, fix typos and move columns; columns
  are found by their header. A row you type in by hand gets an ID the next time the app loads.
  Don't rename the headers or edit the `ID` column.
- **Two people editing the same item:** only the fields each person changed are sent, so edits to
  different fields both survive. If both change the same field, the later save wins.
- **Label photos** are uploaded to the Drive folder after the item itself. The `Photo` column links
  to the file. Other devices download a photo when someone opens the item. Deleting an item moves
  its photo to the Drive trash.
- **Categories:** Keyboard, Mouse, Monitor, RAM, Processor, Graphics card, Storage, Motherboard and
  Other. Pick one when saving a scan (the last one is remembered on that device), in an item's
  details, or in the spreadsheet's Category column. History and the spreadsheet can show one
  category at a time, and the dashboard counts items by category. In Google Sheets the `Category`
  column has the same list as a dropdown. Typing another word there still works; the app shows it
  as its own category. To change the list, edit `CATEGORIES` in both `src/storage.js` and
  `app-script/code.gs`.

## Updating `code.gs`

After pasting a newer `code.gs` into Apps Script: **Deploy → Manage deployments → Edit (pencil) →
Version: New version → Deploy**. The URL stays the same, so Vercel needs no change.

A sheet made by an older `code.gs` gets any new columns (such as `Category`) the first time the new
version runs; existing rows are kept. While the deployed `code.gs` is older than the app, the app
shows a warning naming the fields the sheet won't save.

## Security

- To revoke access (say, the token leaked), run `generateSyncToken` again and put the new token in
  Vercel. The old one stops working at once. `removeSyncToken` turns access off completely.
- To change the app password, change `APP_PASSWORD` in Vercel and redeploy. Every device goes back
  to the login screen and asks for the new one.
- A wrong password is answered after a one-second pause, to slow down guessing. Still, use a long
  password: it is the only thing between the internet and the stock list.
- `SYNC_TOKEN` and `SPREADSHEET_URL` at the top of `code.gs` should stay empty in this repo. Fill
  them in only inside the Apps Script editor, if at all.

## Development

```bash
npm install
npm run dev     # the app on its own: the list is kept in the browser, no sheet needed
npm test        # unit tests (vitest)
npm run lint
npm run build
```

`.env.production` sets `VITE_REMOTE_API=/api/gas`, so builds on Vercel use the sheet. To try the
sheet locally, put `GAS_URL`, `SYNC_TOKEN` and `APP_PASSWORD` in a `.env` file (git-ignored, see
`.env.example`) and run `vercel dev`.

| File                    | What it does                                                          |
| ----------------------- | --------------------------------------------------------------------- |
| `app-script/code.gs`    | The database: the `Items` sheet and the photos folder                 |
| `api/gas.js`            | Vercel function between the app and Apps Script                       |
| `src/lib/api.js`        | Calls `api/gas.js`; remembers the app password                        |
| `src/stock.js`          | The stock list: offline queue, sending, checking for changes          |
| `src/sync.js`           | The queue's rules (what is sent, in what order)                       |
| `src/photos.js`         | Label photos kept on the device (IndexedDB)                           |
