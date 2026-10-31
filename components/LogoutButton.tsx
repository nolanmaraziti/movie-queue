"use client";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/");
  }
  return <button className="pill ghost" onClick={logout}>Log out</button>;
}
