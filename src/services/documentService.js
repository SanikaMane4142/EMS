import { supabase } from '../lib/supabaseClient';

const BUCKET_NAME = 'documents';

export const documentService = {
  /**
   * Upload a document to storage and create a DB record.
   * @param {string} userId - User to whom the document belongs
   * @param {File} file - The file to upload
   * @param {Object} metadata - { category, title, uploadedBy }
   */
  async uploadDocument(userId, file, metadata) {
    if (!userId || !file || !metadata) {
      throw new Error('Missing required fields for document upload');
    }

    // 1. Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    // Create a unique path: {userId}/{timestamp}-{random}.{ext}
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { data: storageData, error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (storageError) {
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    // Get public URL (or signed URL if bucket is private)
    // If bucket is private, we should get signed URL later. For now, store the path.
    const fileUrl = storageData.path;

    // 2. Insert record into user_documents table
    const { data: dbData, error: dbError } = await supabase
      .from('user_documents')
      .insert([
        {
          user_id: userId,
          category: metadata.category,
          title: metadata.title || file.name,
          file_name: file.name,
          file_url: fileUrl,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: metadata.uploadedBy,
        },
      ])
      .select()
      .single();

    if (dbError) {
      // Rollback storage upload if DB fails
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    return dbData;
  },

  /**
   * Fetch documents for a specific user
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getUserDocuments(userId) {
    const { data, error } = await supabase
      .from('user_documents')
      .select(`
        *,
        uploaded_by_profile:profiles!user_documents_uploaded_by_fkey(full_name, role)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    return data;
  },

  /**
   * Delete a document
   * @param {string} documentId
   * @param {string} fileUrl - The storage path
   */
  async deleteDocument(documentId, fileUrl) {
    // 1. Delete from database
    const { error: dbError } = await supabase
      .from('user_documents')
      .delete()
      .eq('id', documentId);

    if (dbError) {
      throw new Error(`Failed to delete document record: ${dbError.message}`);
    }

    // 2. Delete from storage
    if (fileUrl) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([fileUrl]);
        
      if (storageError) {
        console.error('Failed to delete file from storage:', storageError);
        // We don't throw here because DB record is already deleted, 
        // but we log it for cleanup later if needed.
      }
    }
    return true;
  },

  /**
   * Get a signed URL to download/view the file securely
   * @param {string} fileUrl - The storage path
   */
  async getDownloadUrl(fileUrl) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileUrl, 60 * 60); // 1 hour expiry

    if (error) {
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }

    return data.signedUrl;
  }
};
