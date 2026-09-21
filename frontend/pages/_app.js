// pages/_app.js
//
// Next.js wraps every page with this component. We only use it to load
// the global stylesheet.

import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
