-- Film lagrad hos Bunny Stream: komprimeras automatiskt för mobilen och spelas med signerade länkar.
alter table workouts add column video_provider text not null default 'link' check (video_provider in ('link', 'bunny'));
alter table workouts add column video_id text;
alter table workouts add column video_status text;   -- uploading, processing, ready, failed
