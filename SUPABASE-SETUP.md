# Enable shared support chat

The chat uses this Supabase project's publishable key, email/password accounts,
private image storage, and a separate staff account. It is not ready for use
until the database setup and staff access below are completed. Existing
browser-only preview conversations are not transferred.

1. Sign in to the Supabase dashboard and open the project.
2. Open **SQL Editor**, create a new query, paste the complete contents of
   `supabase-setup.sql`, and run it once. Stop if it reports an error; do not
   remove existing tables or policies to make it run.
3. In **Authentication**, ensure email/password sign-in and account creation
   are enabled. If email confirmation is required, customers must confirm
   their email before signing in. Configure the site's URL and allowed
   redirect URLs for your hosted site.
4. Create a staff user in **Authentication > Users**, and make sure the
   account is confirmed. Then run the following separately in SQL Editor,
   replacing the placeholder with the staff account's email:

   ```sql
   insert into public.support_admins (user_id)
   select id from auth.users where lower(email) = lower('STAFF_EMAIL_HERE');
   ```

   The command should insert one row. Never paste passwords or access tokens
   into this SQL.
5. Host the files from this folder on a public HTTPS website. Open `index.html`
   for customers and `admin.html` for staff. Sign in with a customer account
   on one device and the authorized staff account on another.

Messages and typing status refresh approximately every two seconds. Customer
images are stored in a private bucket and served through temporary signed
URLs. Only that customer and authorized staff can access their conversation
and images. Images must be JPEG, PNG, GIF or WebP and no larger than 5 MB.

Do not put a service-role key, database password or management access token
in the website. Password reset is not yet implemented in the app. Before
using this for real support, configure email delivery, rate limits and
backups, review the policies and test access with separate accounts.
