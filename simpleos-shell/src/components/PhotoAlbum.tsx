interface PhotoAlbumProps {
  photos: string[]
  onOpen: (index: number) => void
  onRefresh: () => void
}

/** Big, simple album of local photos downloaded to this computer. */
export function PhotoAlbum({ photos, onOpen, onRefresh }: PhotoAlbumProps) {
  return (
    <section className="panel" aria-labelledby="album-title">
      <h2 id="album-title">Photo Album</h2>
      <p className="panel__intro">
        Pictures you save to Downloads show up here. Choose one to open it in the photo viewer.
      </p>

      {photos.length === 0 ? (
        <div className="panel__empty" role="status">
          <p>No photos here yet.</p>
          <p>
            Save a picture from a website or an email to the Downloads folder, then come back.
          </p>
          <button type="button" className="button" onClick={onRefresh}>
            Check for photos
          </button>
        </div>
      ) : (
        <ul className="album__grid">
          {photos.map((photo, index) => (
            <li className="album__item" key={`${index}-${photo.length}`}>
              <button
                type="button"
                className="album__photo"
                aria-label={`Open photo ${index + 1}`}
                onClick={() => onOpen(index)}
              >
                <img src={photo} alt="" />
                <span>Photo {index + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="button button--secondary" onClick={onRefresh}>
        Check for new photos
      </button>
    </section>
  )
}
