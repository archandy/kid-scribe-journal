-- Drop the trigger first (since it depends on the function)
DROP TRIGGER IF EXISTS on_auth_user_created_family ON auth.users;

-- Then drop the function
DROP FUNCTION IF EXISTS public.handle_new_user_family() CASCADE;