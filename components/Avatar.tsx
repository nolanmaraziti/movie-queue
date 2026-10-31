// A round picture with the first letter of someone's username, in a color picked from their name.
export default function Avatar({ username, size = 40 }: { username: string; size?: number }) {
  let h = 0;
  for (const c of username) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: `hsl(${h % 360} 24% 38%)` }}
    >
      {username.charAt(0).toUpperCase()}
    </span>
  );
}
