# Trip-expense

A simple, mobile-friendly app to split shared trip expenses and settle up with the fewest payments.
Installable on Android as a Progressive Web App (PWA) and works offline.

## Features
- Add the people on a trip and record expenses (who paid, how much, who shared it)
- Equal split among the selected people
- Per-person balances showing who should receive and who should pay
- Settle-up suggestions that keep the number of payments small
- Share the summary on WhatsApp or other apps
- Data saved on the device; works offline after the first load
- Money handled in integer paise to avoid floating-point rounding errors

## How it works
1. Each expense is split equally among the people who shared it. Leftover paise are distributed one at a time, so the total always adds up exactly.
2. Net balance = amount paid - amount owed. All balances sum to zero.
3. A greedy settle-up algorithm repeatedly matches the person who owes the most with the person who is owed the most, so a group of n people needs at most n-1 payments.

## Example
Rahul pays 3000 for the hotel, Aman pays 900 for dinner, and Priya pays 600 for a cab shared with Rahul.
Result: Priya pays Rahul 1000 and Aman pays Rahul 400.

## Tech stack
HTML, CSS and vanilla JavaScript, with a service worker for offline use and a web app manifest for installation. No frameworks or backend.

## Run it
Open `index.html` in a browser, or visit the hosted link and choose "Install app" in Chrome on Android.

## Possible improvements
- Unequal splits (exact amounts, percentages, shares)
- Multiple trips
- Expense categories and charts
