export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#f5f5f0", color: "#1a1a18" }}>
        {children}
      </body>
    </html>
  );
}
