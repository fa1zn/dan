import type { ReactNode } from "react";

export const metadata = {
  title: "Dan, Pam's sales guy",
  description:
    "Dan is Pam's AI sales rep. This is his book of business: the system of record for North American franchise dealerships.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
