import React, { useState, useEffect } from 'react';
import styles from './EventAttachments.module.scss'

interface Attachment {
  FileName: string;
  ServerRelativeUrl: string;
}

interface EventAttachmentsProps {
  itemId: number;  // The event's ID
}

const EventAttachments: React.FC<EventAttachmentsProps> = ({ itemId }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch attachments when component mounts or itemId changes
  useEffect(() => {
    const fetchAttachments = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/_api/web/lists/getbytitle('RoB Calendar Events')/items(${itemId})/AttachmentFiles`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json;odata=verbose',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Error fetching attachments: ${response.statusText}`);
        }

        const data = await response.json();
        const fetchedAttachments: Attachment[] = data.d.results.map((item: any) => ({
          FileName: item.FileName,
          ServerRelativeUrl: item.ServerRelativeUrl,
        }));
        setAttachments(fetchedAttachments);
      } catch (error: any) {
        console.error('Error fetching attachments:', error);
        setError('Failed to load attachments.');
      } finally {
        setLoading(false);
      }
    };

    fetchAttachments();
  }, [itemId]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setError(null); // Clear previous errors
    }
  };

  // Helper function to get the form digest value
  const getFormDigest = async () => {
    try {
      const response = await fetch(`/_api/contextinfo`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json;odata=verbose',
        },
      });

      if (!response.ok) {
        throw new Error(`Error fetching form digest: ${response.statusText}`);
      }

      const data = await response.json();
      return data.d.GetContextWebInformation.FormDigestValue;
    } catch (error: any) {
      console.error('Error fetching form digest:', error);
      throw new Error('Unable to obtain form digest value.');
    }
  };

  // Upload the selected files to SharePoint
    const uploadAttachments = async () => {
      if (files.length === 0) {
      setError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const digest = await getFormDigest();
      // Iterate over each selected file and upload them
      for (const file of files) {
      const uploadUrl = `/_api/web/lists/getbytitle('RoB Calendar Events')/items(${itemId})/AttachmentFiles/add(FileName='${encodeURIComponent(file.name)}')`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: file, // Send the raw file
        headers: {
          'Accept': 'application/json;odata=verbose',
          'Content-Type': 'application/octet-stream',
          'X-RequestDigest': digest,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message?.value || response.statusText;
        throw new Error(`Error uploading file: ${errorMessage}`);
      }

      const data = await response.json();
      const newAttachment: Attachment = {
        FileName: data.d.FileName,
        ServerRelativeUrl: data.d.ServerRelativeUrl,
      };

      setAttachments((prev) => [...prev, newAttachment]);
    }
      // Clear the selected files after successful upload
      setFiles([]);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      setError(error.message || 'An unexpected error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  // Optional: Handle Enter key for upload
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      uploadAttachments();
    }
  };
  
  // Remove an attachment from SharePoint
  const removeAttachment = async (attachment: Attachment) => {
    const confirmDelete = window.confirm(`Are you sure you want to remove ${attachment.FileName}?`);
    if (!confirmDelete) return;

    setUploading(true);
    setError(null);

    try {
      const digest = await getFormDigest();

      const deleteUrl = `/_api/web/getfilebyserverrelativeurl('${attachment.ServerRelativeUrl}')`;

      const response = await fetch(deleteUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json;odata=verbose',
          'X-RequestDigest': digest,
          'IF-MATCH': '*',
          'X-HTTP-Method': 'DELETE',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message?.value || response.statusText;
        throw new Error(`Error removing attachment: ${errorMessage}`);
      }

      // Update state after successful deletion
      setAttachments((prev) => prev.filter(a => a.FileName !== attachment.FileName));
    } catch (error: any) {
      console.error('Error removing attachment:', error);
      setError(error.message || 'An unexpected error occurred while removing the attachment.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h3 className={styles.title}>Attachments</h3>
      {/* Upload Section */}
      <div className={styles.topSection}>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              onKeyPress={handleKeyPress}
              disabled={uploading}
              className={styles.spText}
            />
            <button onClick={uploadAttachments} disabled={uploading || files.length === 0} className={`${styles.addButton} ${styles.spText}`}>
              {uploading ? 'Saving Changes...' : 'Upload Attachments'}
            </button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>

      {/* Display Loading State */}
      {loading ? (
        <div>Loading attachments...</div>
      ) : (
        <>
          {/* Display Attachments List */}
          {attachments.length === 0 ? (
            <div style={{ marginTop: '20px' }}>No attachments available.</div>
          ) : (
            <div className={styles.fileList}>
              {attachments.map((attachment) => (
                <div key={attachment.FileName} className={styles.fileItem}>
                  <a
                    href={attachment.ServerRelativeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.fileName} ${styles.spText}`}
                  >
                    {attachment.FileName}
                  </a>
                  <button onClick={() => removeAttachment(attachment)} disabled={uploading} className={`${styles.removeButton} ${styles.spText}`}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EventAttachments;
