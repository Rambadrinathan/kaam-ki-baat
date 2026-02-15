-- Allow users to delete their own self-proposed tasks
CREATE POLICY "Users can delete their own self-proposed tasks"
ON public.tasks
FOR DELETE
USING (
  created_by_user_id = auth.uid() 
  AND type = 'self_proposed'
  AND status != 'completed'
);

-- Allow users to delete their own task assignments
CREATE POLICY "Users can delete their own assignments"
ON public.task_assignments
FOR DELETE
USING (
  assigned_to_user_id = auth.uid()
);