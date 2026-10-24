// Shown instead of the app when the database isn't connected yet.
export default function SetupNeeded({ message }: { message: string }) {
  return (
    <div className="app">
      <header>
        <div className="top">
          <h1>Movie<br />Queue</h1>
        </div>
      </header>
      <div className="empty">
        <strong>Almost there</strong>
        <span>{message}</span>
      </div>
    </div>
  );
}
