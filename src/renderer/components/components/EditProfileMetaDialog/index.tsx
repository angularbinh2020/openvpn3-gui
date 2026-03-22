import React from 'react';
interface Props {
  editMeta: {
    path: string;
    notes: string;
    tags: string;
  };
  setEditMeta: any;
  handleSaveMeta: () => Promise<void>;
}
export const EditProfileMetaDialog = ({
  editMeta,
  setEditMeta,
  handleSaveMeta,
}: Props) => {
  return (
    <div className="modal-overlay" onClick={() => setEditMeta(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Edit Profile Info</div>
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              display: "block",
              marginBottom: 4,
            }}
          >
            TAGS (comma-separated)
          </label>
          <input
            className="text-input"
            value={editMeta.tags}
            onChange={(e) => setEditMeta({ ...editMeta, tags: e.target.value })}
            placeholder="work, personal, us-east..."
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              display: "block",
              marginBottom: 4,
            }}
          >
            NOTES
          </label>
          <textarea
            className="textarea"
            value={editMeta.notes}
            onChange={(e) =>
              setEditMeta({ ...editMeta, notes: e.target.value })
            }
            placeholder="Add notes about this profile..."
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setEditMeta(null)}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSaveMeta}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
