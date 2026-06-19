import { supabase } from './supabase'

export const TASK_IMAGES_BUCKET = 'task-images'

// Delete a task and also remove its image files from storage so they don't
// linger after the attachment rows are cascade-deleted.
export async function deleteTaskWithFiles(id) {
  const { data: atts } = await supabase
    .from('task_attachments')
    .select('storage_path')
    .eq('task_id', id)

  if (atts?.length) {
    await supabase.storage
      .from(TASK_IMAGES_BUCKET)
      .remove(atts.map((a) => a.storage_path))
  }

  await supabase.from('tasks').delete().eq('id', id)
}
