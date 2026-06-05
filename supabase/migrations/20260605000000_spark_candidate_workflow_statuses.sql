alter type "public"."SparkApplicationStatus" add value if not exists 'Invited';
alter type "public"."SparkApplicationStatus" add value if not exists 'InProcess';
alter type "public"."SparkApplicationStatus" add value if not exists 'Complete';
alter type "public"."SparkApplicationStatus" add value if not exists 'Reviewing';
alter type "public"."SparkApplicationStatus" add value if not exists 'Shortlisted';
alter type "public"."SparkApplicationStatus" add value if not exists 'Offer';

notify pgrst, 'reload schema';
