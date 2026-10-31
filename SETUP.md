# Setting up shared trips (free Firebase)

Sharing needs a small free cloud database. You do this once, about 10 minutes.

## 1. Create a Firebase project
1. Go to https://console.firebase.google.com and sign in with Google.
2. Click **Create a project**, name it `trip-split`, and continue.
3. Turn **Google Analytics off** (not needed), then click **Create project**.

## 2. Create the database
1. In the left menu choose **Build -> Firestore Database**, then **Create database**.
2. Pick a location close to you (for India: `asia-south1` Mumbai). The location cannot be changed later.
3. Choose **Start in production mode**, then **Create**.
4. Open the **Rules** tab, delete everything there, paste the contents of `firestore.rules`, and click **Publish**.

## 3. Get your app settings
1. Click the gear icon next to **Project Overview**, then **Project settings**.
2. Under **Your apps**, click the web icon `</>`.
3. Name it `trip-split-web`. Leave "Firebase Hosting" unticked, then click **Register app**.
4. You will see a `firebaseConfig = { ... }` block. Copy the values into `firebase-config.js`
   (replace each `PASTE_...` value). Keep the quotes.

## 4. Upload to GitHub
Upload these files to your repo (Add file -> Upload files, same names replace the old ones):
`index.html`, `sw.js`, `firebase-config.js`, `firestore.rules`, `SETUP.md`

Wait 1-2 minutes, then open https://ps-pushpendra.github.io/Trip-expense/ in Chrome on two phones.

## 5. Try it
1. Phone 1: add people and expenses, tap **Share this trip**. A trip code appears.
2. Tap **Share** and send the link on WhatsApp.
3. Phone 2: open the link. The same trip appears, and changes show on both phones within a second or two.

## Good to know
- Anyone who has the trip code can see and edit that trip, so only share it with your group.
- The rules block listing all trips, so codes cannot be discovered by guessing a list.
- Changes need an internet connection to reach friends. Without internet, the trip stays visible on the phone.
- Free plan limits are far above what a trip group needs.
