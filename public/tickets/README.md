# Supplied artwork

`reference.png` is the unmodified PNG fetched from the supplied Google Drive file:
https://drive.google.com/file/d/1Rn67WlqKkFgsdBylSJrcXX0PfHLEpdD2/view

`reference.png` contains one cauldron ticket, not a contact sheet. The directory now contains all 12 distinct individual original PNGs. No extraction, cropping, resampling, renaming or replacement artwork was performed. The filenames are preserved in `src/config/ticket-collection.json`.

| Edition ID | Original filename | Canvas |
| --- | --- | --- |
| cauldron | reference.png | 1916 × 821 |
| seated-cat | Εικόνα ChatGPT 27 Οκτ 2026, 08_01_00 π.μ-1.png | 1942 × 809 |
| moon-castle | Εικόνα ChatGPT 27 Οκτ 2026, 08_01_01 π.μ-2.png | 1916 × 821 |
| ghost-pumpkin | 79713ef0-0d06-4d29-aae0-3ab87fce4d6d.png | 1942 × 809 |
| pumpkin-lantern | 70b6df68-0105-4711-b1f4-85e3da4030ac.png | 1916 × 821 |
| witch-hat | 1e1966c9-1b58-48a8-8e0e-e33215ad72fd.png | 1942 × 809 |
| cat-pumpkin-stack | 060d8646-1ff8-4c6d-9f08-90776c914ffb.png | 1916 × 821 |
| three-ghosts | e787db50-8937-4491-86e7-590d4b020fe1.png | 1942 × 809 |
| cat-eyes | Εικόνα ChatGPT 27 Οκτ 2026, 08_18_05 π.μ.png | 1916 × 821 |
| moon-moths | Αποκριάτικο Εισιτήριο Κάτω Από Άστρα.png | 1920 × 819 |
| arched-cat | Τρομακτική Απόκριες Μάζωξη με Μαύρη Γάτα.png | 1920 × 819 |
| orange-tree | Halloween Μάζωξη_ Πορτοκαλί Εισιτήριο.png | 1774 × 887 |

No further exports are required to preview the complete collection. Each image is a single ticket; the different canvas aspect ratios are retained.

The QR baked into every image is a placement reference, never an admission credential. The manifest records its full-canvas pixel rectangle. Phase 2 supplies `Ticket.qrContent` with a real owner-retrieved credential QR, moving with the stub. The rectangle is covered in opaque white; the SVG retains square modules and at least four modules of quiet zone without stretching to the slightly rectangular source box. All 12 overlays passed automated decoding/compositing and a contact-sheet visual inspection. A clean QR-area source export at the same native canvas size is optional; the current overlays preserve the original frames. Real-device browser and camera tests remain outstanding. The original images themselves are never modified.

Perforation and hinge coordinates are separately configured for every design, accounting for the varying transparent margins and lower notches. The stub swings down from its lower-left attachment, and stays visible. The pale amber/mauve ADMITTED label remains below the main artwork.

Run `npm run artwork:check` to validate all 12 unique files, PNG canvas sizes, QR containment and lower hinge ranges. It prints SHA-256 hashes to support integrity comparisons. Browser review remains necessary for pixel alignment and animation on real devices; the check does not claim to prove visual alignment.
