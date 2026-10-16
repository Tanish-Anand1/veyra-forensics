# Third-party notices

Fonts are shipped locally from these npm packages, which include their own license text:

- `@fontsource/archivo-black`: Archivo Black, Omnibus-Type, SIL Open Font License. Native 400 weight for the VEYRA wordmark. [Project and licensing](https://github.com/Omnibus-Type/ArchivoBlack).
- `@fontsource/barlow-condensed`: Barlow Condensed, Jeremy Tribby, SIL Open Font License. Weights 600, 700 and 800. [Project and licensing](https://github.com/jpt/barlow).
- `@fontsource/ibm-plex-sans`: IBM Plex Sans, IBM, SIL Open Font License. Weights 400, 500 and 600 for application UI. [Project and licensing](https://github.com/IBM/plex).
- `@fontsource/ibm-plex-mono`: IBM Plex Mono, IBM, SIL Open Font License. [Project and licensing](https://github.com/IBM/plex).

Only Latin subsets are downloaded for the interface, with font-display swap and system fallbacks for other scripts. PDF exports embed IBM Plex Sans and Archivo Black; complex scripts use browser shaping and retain exact UTF-8 text in the attached evidence record.

The static sculpture images and social preview are renders of this project's original Three.js geometry. The mobile and reduced-motion versions use the same sculpture without loading WebGL. No reference-site artwork or assets were copied.

The license copies are included in `public/licenses` and the production static output. Other software dependency licenses remain in their installed packages. GSAP, React, Three.js, React Three Fiber, Express, Zod and the OpenAI SDK are used as implementation dependencies; consult their package licenses before redistributing or changing the deployment model.
