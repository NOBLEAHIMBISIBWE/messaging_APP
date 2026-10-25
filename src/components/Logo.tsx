import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" className="font-display text-2xl font-extrabold tracking-tight">
      whispr<span className="text-primary">.</span>
    </Link>
  );
}
