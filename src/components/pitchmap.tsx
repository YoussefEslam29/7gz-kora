// The pitch on a map (Plans/Accounts-groups-and-chat.md section 7): Google's
// map with a pin, which opens Google Maps when tapped. Without a position,
// just the "Open in Google Maps" button.
import { mapEmbedUrl } from '../lib/maplink'
import { PinIcon } from './icons'

export function PitchMap({ url, lat, lng }: { url: string | null; lat: number | null; lng: number | null }) {
  if (!url) return null
  if (lat == null || lng == null) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
        <PinIcon size={18} /> Open in Google Maps
      </a>
    )
  }
  return (
    <div className="relative h-40 overflow-hidden rounded-xl border-[1.5px] border-line bg-line">
      {/* The map works as a picture here: a tap goes to the link on top of it. */}
      <iframe
        title="Map of the pitch"
        src={mapEmbedUrl({ lat, lng })}
        loading="lazy"
        tabIndex={-1}
        aria-hidden
        referrerPolicy="no-referrer-when-downgrade"
        className="pointer-events-none size-full border-0"
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open the pitch in Google Maps"
        className="absolute inset-0 flex items-end justify-end p-2"
      >
        <span className="chip bg-paper">
          <PinIcon size={14} /> Open in Google Maps
        </span>
      </a>
    </div>
  )
}
