import { useState } from "react";

/**
 * Sleeper's public image CDN. Read-only GETs of images, in the same spirit as the read-only API —
 * no auth, no writes. Every one of these can 404 (a manager with no avatar set, a player Sleeper
 * has no headshot for, a defense), so nothing here renders without a fallback that fits the same
 * box: an initials disc. That keeps a broken image from changing a row's height.
 */
const CDN = "https://sleepercdn.com";
const teamLogo = (code: string) => `${CDN}/images/team_logos/nfl/${code.toLowerCase()}.png`;

/** "Comedor De Culos" → CC, "EBITDAwgs" → EB. Never empty — the disc is a fixed-size box. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** A manager's Sleeper avatar. `thumbs/` is the 100px variant — the full one is ~1MB per team. */
export function TeamAvatar({ avatar, name }: { avatar?: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!avatar || broken) return <span className="avatar is-fallback">{initials(name)}</span>;
  return (
    <img
      className="avatar"
      src={`${CDN}/avatars/thumbs/${avatar}`}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

/**
 * A player headshot with his NFL team's logo badged into the corner. Defenses have no headshot —
 * their playerId IS the team code — so the logo becomes the portrait instead of the badge.
 */
export function PlayerAvatar({
  playerId,
  name,
  position,
  nflTeam,
}: {
  playerId: string;
  name: string;
  position: string;
  nflTeam?: string | null;
}) {
  const [broken, setBroken] = useState(false);
  const [badgeBroken, setBadgeBroken] = useState(false);
  const isDef = position === "DEF" || position === "DST";
  const src = isDef ? teamLogo(playerId) : `${CDN}/content/nfl/players/thumb/${playerId}.jpg`;
  return (
    <span className="pavatar">
      {broken ? (
        <span className="avatar is-lg is-fallback">{initials(name)}</span>
      ) : (
        <img className={"avatar is-lg" + (isDef ? " is-logo" : "")} src={src} alt="" onError={() => setBroken(true)} />
      )}
      {nflTeam && !isDef && !badgeBroken && (
        <img className="pavatar-badge" src={teamLogo(nflTeam)} alt="" onError={() => setBadgeBroken(true)} />
      )}
    </span>
  );
}
