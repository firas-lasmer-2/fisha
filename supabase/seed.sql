-- ============================================================
-- Shifa: Comprehensive Dev Seed Data
-- ============================================================
-- Creates stable UUIDs for each test user so you can re-run
-- this seed idempotently (all inserts use ON CONFLICT DO NOTHING).
--
-- UUIDs are deterministic hex values — safe to hard-code in tests.
-- ============================================================

-- ── 0. Stable test UUIDs ────────────────────────────────────
-- Therapists
\set therapist1_id '00000000-0000-0000-0000-000000000001'
\set therapist2_id '00000000-0000-0000-0000-000000000002'
\set therapist3_id '00000000-0000-0000-0000-000000000003'
-- Clients
\set client1_id   '00000000-0000-0000-0000-000000000011'
\set client2_id   '00000000-0000-0000-0000-000000000012'
\set client3_id   '00000000-0000-0000-0000-000000000013'
\set client4_id   '00000000-0000-0000-0000-000000000014'
\set client5_id   '00000000-0000-0000-0000-000000000015'
-- Listeners
\set listener1_id '00000000-0000-0000-0000-000000000021'
\set listener2_id '00000000-0000-0000-0000-000000000022'
-- Admin
\set admin_id     '00000000-0000-0000-0000-000000000031'

-- ── 1. Auth users (Supabase internal table) ──────────────────
-- Password for all test accounts: Shifa2024!
-- bcrypt hash of 'Shifa2024!' with cost 10
\set test_pw_hash '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LkdREezYiuu'

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  -- Therapists
  (:'therapist1_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'therapist1@shifa.dev', :'test_pw_hash', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false),
  (:'therapist2_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'therapist2@shifa.dev', :'test_pw_hash', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false),
  (:'therapist3_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'therapist3@shifa.dev', :'test_pw_hash', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false),
  -- Clients
  (:'client1_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'client1@shifa.dev', :'test_pw_hash', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false),
  (:'client2_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'client2@shifa.dev', :'test_pw_hash', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false),
  (:'client3_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'client3@shifa.dev', :'test_pw_hash', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false),
  (:'client4_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'client4@shifa.dev', :'test_pw_hash', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false),
  (:'client5_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'client5@shifa.dev', :'test_pw_hash', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false),
  -- Listeners
  (:'listener1_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'listener1@shifa.dev', :'test_pw_hash', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false),
  (:'listener2_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'listener2@shifa.dev', :'test_pw_hash', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false),
  -- Admin
  (:'admin_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@shifa.dev', :'test_pw_hash', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false)
on conflict (id) do nothing;

-- ── 2. Profiles ──────────────────────────────────────────────
insert into public.profiles (id, email, first_name, last_name, role, language_preference, onboarding_completed)
values
  -- Therapists
  (:'therapist1_id', 'therapist1@shifa.dev', 'Sana',   'Belhaj',  'therapist', 'ar', true),
  (:'therapist2_id', 'therapist2@shifa.dev', 'Karim',  'Trabelsi','therapist', 'fr', true),
  (:'therapist3_id', 'therapist3@shifa.dev', 'Leila',  'Mansour', 'therapist', 'ar', true),
  -- Clients
  (:'client1_id',  'client1@shifa.dev', 'Amira',  'Ben Ali',   'client', 'ar', true),
  (:'client2_id',  'client2@shifa.dev', 'Youssef','Hamdi',     'client', 'fr', true),
  (:'client3_id',  'client3@shifa.dev', 'Fatma',  'Riahi',     'client', 'ar', true),
  (:'client4_id',  'client4@shifa.dev', 'Omar',   'Jendoubi',  'client', 'ar', false),
  (:'client5_id',  'client5@shifa.dev', 'Nadia',  'Gharbi',    'client', 'fr', true),
  -- Listeners
  (:'listener1_id','listener1@shifa.dev','Wafa',   'Chaabane',  'listener', 'ar', true),
  (:'listener2_id','listener2@shifa.dev','Mehdi',  'Zouari',    'listener', 'ar', true),
  -- Admin
  (:'admin_id',    'admin@shifa.dev',   'Admin',  'Shifa',     'admin',    'ar', true)
on conflict (id) do nothing;

-- ── 3. Therapist profiles ─────────────────────────────────────
insert into public.therapist_profiles (
  user_id, license_number, specializations, languages,
  rate_dinar, verified, rating, review_count,
  years_experience, education, approach,
  gender, headline, about_me, slug,
  accepts_online, accepts_in_person, tier
) values
  (
    :'therapist1_id', 'TN-PSY-2018-001',
    ARRAY['anxiety','depression','stress','self_esteem'],
    ARRAY['ar','fr'],
    80, true, 4.8, 24,
    6, 'PhD in Clinical Psychology, University of Tunis',
    'Cognitive Behavioral Therapy (CBT) and mindfulness-based approaches',
    'female',
    'Helping you find calm in the storm',
    'I specialize in anxiety and depression treatment using evidence-based CBT techniques. My approach is warm, non-judgmental, and tailored to your unique needs. Available online and in Tunis.',
    'sana-belhaj',
    true, true, 'graduated_doctor'
  ),
  (
    :'therapist2_id', 'TN-PSY-2015-042',
    ARRAY['relationships','couples','family','trauma'],
    ARRAY['fr','ar'],
    120, true, 4.6, 18,
    9, 'Master in Family & Couples Therapy, University of Sfax',
    'Systemic family therapy and emotion-focused therapy',
    'male',
    'Rebuilding connections, one session at a time',
    'Spécialisé en thérapie de couple et familiale, j''accompagne les individus et les familles à traverser les crises avec résilience. Bilingue arabe-français.',
    'karim-trabelsi',
    true, false, 'premium_doctor'
  ),
  (
    :'therapist3_id', 'TN-PSY-2020-078',
    ARRAY['grief','trauma','stress','anxiety'],
    ARRAY['ar'],
    60, true, 4.4, 11,
    4, 'Bachelor in Psychology, University of Sousse',
    'Person-centered therapy with trauma-informed care',
    'female',
    'A safe space to heal and grow',
    'I work with clients navigating grief, trauma, and life transitions. My sessions are conducted in Arabic and focus on building inner resilience.',
    'leila-mansour',
    true, true, 'graduated_doctor'
  )
on conflict (user_id) do nothing;

-- ── 4. Therapist slots (open slots for the next 7 days) ──────
insert into public.therapist_slots (therapist_id, starts_at, duration_minutes, price_dinar, status)
values
  -- Therapist 1 slots
  (:'therapist1_id', now() + interval '1 day' + interval '9 hours',  50, 80, 'open'),
  (:'therapist1_id', now() + interval '1 day' + interval '14 hours', 50, 80, 'open'),
  (:'therapist1_id', now() + interval '3 days' + interval '10 hours',50, 80, 'open'),
  (:'therapist1_id', now() + interval '5 days' + interval '9 hours', 50, 80, 'open'),
  -- Therapist 2 slots
  (:'therapist2_id', now() + interval '2 days' + interval '10 hours',50, 120, 'open'),
  (:'therapist2_id', now() + interval '2 days' + interval '15 hours',50, 120, 'open'),
  (:'therapist2_id', now() + interval '4 days' + interval '9 hours', 50, 120, 'open'),
  -- Therapist 3 slots
  (:'therapist3_id', now() + interval '1 day' + interval '11 hours', 50, 60, 'open'),
  (:'therapist3_id', now() + interval '3 days' + interval '14 hours',50, 60, 'open'),
  (:'therapist3_id', now() + interval '6 days' + interval '10 hours',50, 60, 'open')
on conflict do nothing;

-- ── 5. Appointments ───────────────────────────────────────────
insert into public.appointments (
  client_id, therapist_id, scheduled_at, duration_minutes,
  session_type, status, price_dinar
) values
  -- Past completed sessions
  (:'client1_id', :'therapist1_id', now() - interval '14 days', 50, 'video', 'completed', 80),
  (:'client1_id', :'therapist1_id', now() - interval '7 days',  50, 'video', 'completed', 80),
  (:'client2_id', :'therapist2_id', now() - interval '10 days', 50, 'video', 'completed', 120),
  (:'client3_id', :'therapist3_id', now() - interval '5 days',  50, 'chat',  'completed', 60),
  (:'client5_id', :'therapist1_id', now() - interval '3 days',  50, 'video', 'completed', 80),
  -- Upcoming confirmed sessions
  (:'client1_id', :'therapist1_id', now() + interval '7 days',  50, 'video', 'confirmed', 80),
  (:'client2_id', :'therapist2_id', now() + interval '5 days',  50, 'video', 'confirmed', 120),
  -- Pending session (not yet confirmed)
  (:'client4_id', :'therapist3_id', now() + interval '3 days',  50, 'chat',  'pending', 60)
on conflict do nothing;

-- ── 6. Mood entries (last 30 days for clients 1–3) ────────────
insert into public.mood_entries (user_id, mood_score, emotions, notes, created_at)
values
  -- Client 1: improving trend
  (:'client1_id', 2, ARRAY['anxious','sad'],       'Hard week at work',         now() - interval '28 days'),
  (:'client1_id', 3, ARRAY['stressed'],             'Better after session',      now() - interval '21 days'),
  (:'client1_id', 3, ARRAY['calm','anxious'],       null,                        now() - interval '14 days'),
  (:'client1_id', 4, ARRAY['hopeful'],              'Tried breathing exercises', now() - interval '7 days'),
  (:'client1_id', 4, ARRAY['calm','content'],       'Good day overall',          now() - interval '2 days'),
  -- Client 2: fluctuating
  (:'client2_id', 3, ARRAY['sad','lonely'],         null,                        now() - interval '25 days'),
  (:'client2_id', 4, ARRAY['calm'],                 null,                        now() - interval '18 days'),
  (:'client2_id', 2, ARRAY['overwhelmed','anxious'],'Rough week',                now() - interval '10 days'),
  (:'client2_id', 3, ARRAY['neutral'],              null,                        now() - interval '4 days'),
  -- Client 3: stable low
  (:'client3_id', 2, ARRAY['sad','grief'],          'Missing my father',         now() - interval '20 days'),
  (:'client3_id', 2, ARRAY['sad'],                  null,                        now() - interval '13 days'),
  (:'client3_id', 3, ARRAY['calm','sad'],           'Therapy helping',           now() - interval '6 days')
on conflict do nothing;

-- ── 7. Journal entries ────────────────────────────────────────
insert into public.journal_entries (user_id, title, content, mood, created_at)
values
  (:'client1_id', 'First week in therapy',
   'I was nervous about starting therapy but Dr. Sana made me feel completely at ease. We talked about my anxiety triggers and I learned a new breathing technique.',
   'hopeful', now() - interval '13 days'),
  (:'client1_id', 'Feeling stronger',
   'Used the 4-7-8 breathing during a stressful meeting today. It actually worked. Small win but it matters.',
   'calm', now() - interval '5 days'),
  (:'client2_id', 'Why I finally reached out',
   'I''ve been putting this off for months. The loneliness has been unbearable. Writing this down already feels like a release.',
   'sad', now() - interval '22 days'),
  (:'client2_id', 'After my second session',
   'Karim helped me see how my childhood patterns affect my relationships now. Heavy stuff but necessary.',
   'neutral', now() - interval '8 days'),
  (:'client3_id', 'One year since dad passed',
   'Today was hard. Leila says grief doesn''t follow a schedule. I need to be kinder to myself.',
   'sad', now() - interval '18 days')
on conflict do nothing;

-- ── 8. Onboarding responses ───────────────────────────────────
insert into public.onboarding_responses (user_id, primary_concerns, preferred_language, gender_preference, budget_range)
values
  (:'client1_id', ARRAY['anxiety','stress'],            'ar', 'female', '80-120'),
  (:'client2_id', ARRAY['relationships','depression'],  'fr', 'male',   '100-150'),
  (:'client3_id', ARRAY['grief','trauma'],              'ar', 'female', '60-80'),
  (:'client5_id', ARRAY['anxiety','self_esteem'],       'fr', null,     '80-120')
on conflict do nothing;

-- ── 9. Listener profiles ──────────────────────────────────────
insert into public.listener_profiles (
  user_id, display_alias, languages, topics,
  verification_status, activation_status,
  is_available, headline, about_me, avatar_emoji,
  total_sessions, average_rating
) values
  (
    :'listener1_id', 'Wafa M.',
    ARRAY['ar','fr'], ARRAY['anxiety','relationships','general'],
    'approved', 'active',
    true,
    'Here to listen without judgment',
    'I''m a trained peer listener with experience in anxiety support. I believe everyone deserves to be heard. Available most evenings.',
    '🌙', 12, 4.7
  ),
  (
    :'listener2_id', 'Mehdi Z.',
    ARRAY['ar'], ARRAY['stress','depression','grief'],
    'approved', 'active',
    false,
    'A compassionate ear when you need it',
    'I went through my own mental health journey and now I want to support others. Trained in active listening and crisis awareness.',
    '🤲', 8, 4.5
  )
on conflict (user_id) do nothing;

-- ── 10. Listener progress ─────────────────────────────────────
insert into public.listener_progress (listener_id, points, level, sessions_rated_count)
values
  (:'listener1_id', 240, 3, 10),
  (:'listener2_id', 160, 2, 7)
on conflict (listener_id) do nothing;

-- ── 11. Resources (wellness articles) ────────────────────────
insert into public.resources (title_ar, title_fr, title_darija, content_ar, content_fr, content_darija, category, read_time_minutes)
values
  (
    'كيف تتعامل مع نوبات القلق',
    'Comment gérer les crises d''anxiété',
    'كيفاش تتعامل مع نوبات القلق',
    'القلق هو استجابة طبيعية للضغوط، لكن عندما يصبح مفرطاً يمكن أن يؤثر على حياتك اليومية. إليك خطوات عملية للتعامل مع نوبات القلق: أولاً، تعلم تقنية التنفس العميق - استنشق لمدة 4 ثوانٍ، احبس نفسك لمدة 7 ثوانٍ، ثم ازفر لمدة 8 ثوانٍ. ثانياً، مارس تقنية التأريض بالحواس الخمس. ثالثاً، تحدث مع شخص تثق به.',
    'L''anxiété est une réponse naturelle au stress, mais quand elle devient excessive, elle peut affecter votre vie quotidienne. Voici des étapes pratiques pour gérer les crises d''anxiété : Premièrement, apprenez la technique de respiration profonde - inspirez pendant 4 secondes, retenez pendant 7 secondes, puis expirez pendant 8 secondes. Deuxièmement, pratiquez la technique d''ancrage par les 5 sens. Troisièmement, parlez à quelqu''un en qui vous avez confiance.',
    'القلق حاجة طبيعية كي تكون تحت الضغط، اما كي يولي برشا ينجم يأثر على حياتك. هاذي شوية نصائح: أولاً تعلم تتنفس بعمق - شهق 4 ثواني، وقف 7 ثواني، وزفر 8 ثواني. ثانياً خدم تقنية التأريض بالحواس الخمسة. ثالثاً أحكي مع شخص تثق فيه.',
    'anxiety', 5
  ),
  (
    'فهم الاكتئاب: أعراضه وعلاجه',
    'Comprendre la dépression : symptômes et traitement',
    'فهم الاكتئاب: شنوما أعراضو وعلاجو',
    'الاكتئاب ليس مجرد شعور بالحزن، بل هو حالة صحية تحتاج إلى عناية مهنية. من أعراضه: فقدان الاهتمام بالأنشطة، تغير في النوم والشهية، صعوبة في التركيز، والشعور بالذنب أو عدم القيمة. العلاج متاح وفعال، ويشمل العلاج النفسي والأدوية عند الحاجة. لا تتردد في طلب المساعدة.',
    'La dépression n''est pas simplement un sentiment de tristesse, c''est un état de santé qui nécessite une attention professionnelle. Parmi ses symptômes : perte d''intérêt pour les activités, changements dans le sommeil et l''appétit, difficulté de concentration, et sentiment de culpabilité ou d''inutilité. Le traitement est disponible et efficace, incluant la psychothérapie et les médicaments si nécessaire.',
    'الاكتئاب مش حزن عادي، هو حالة صحية تحتاج عناية مختصة. من أعراضو: ما عندكش خاطر تعمل حاجة، النوم يتبدل، الماكلة تتبدل، صعوبة التركيز. العلاج موجود ويخدم، فيه العلاج النفسي والأدوية كان لزم. ما تخافش تطلب مساعدة.',
    'depression', 7
  ),
  (
    'تقنيات إدارة الضغوط اليومية',
    'Techniques de gestion du stress quotidien',
    'تقنيات باش تتعامل مع الضغط النفسي',
    'الضغط النفسي جزء من الحياة اليومية، خاصة في ظل التحديات الاقتصادية والاجتماعية. إليك تقنيات فعالة: 1. مارس التأمل لمدة 10 دقائق يومياً 2. حافظ على نشاط بدني منتظم 3. نظم وقتك وحدد أولوياتك 4. تعلم أن تقول "لا" 5. خصص وقتاً للأنشطة الممتعة 6. تواصل مع العائلة والأصدقاء',
    'Le stress fait partie de la vie quotidienne, surtout face aux défis économiques et sociaux. Voici des techniques efficaces : 1. Pratiquez la méditation 10 minutes par jour 2. Maintenez une activité physique régulière 3. Organisez votre temps et définissez vos priorités 4. Apprenez à dire "non" 5. Consacrez du temps aux activités plaisantes 6. Restez en contact avec la famille et les amis',
    'الضغط حاجة عادية في حياتنا، خاصة مع التحديات الاقتصادية والاجتماعية. هاذي تقنيات تنفعك: 1. اعمل تأمل 10 دقايق كل يوم 2. اعمل رياضة 3. نظم وقتك 4. تعلم تقول "لا" 5. خصص وقت للحوايج الباهية 6. تواصل مع العايلة والأصحاب',
    'stress', 6
  ),
  (
    'بناء علاقات صحية',
    'Construire des relations saines',
    'كيفاش تبني علاقات صحية',
    'العلاقات الصحية مبنية على التواصل والاحترام المتبادل. نصائح لتحسين علاقاتك: تعلم الاستماع الفعال، عبر عن مشاعرك بوضوح، ضع حدوداً صحية، تقبل الاختلاف، واطلب المساعدة المهنية عند الحاجة. تذكر أن العلاقة الجيدة تتطلب عملاً مستمراً من الطرفين.',
    'Les relations saines sont fondées sur la communication et le respect mutuel. Conseils pour améliorer vos relations : apprenez l''écoute active, exprimez vos sentiments clairement, établissez des limites saines, acceptez les différences, et demandez une aide professionnelle si nécessaire.',
    'العلاقات الباهية مبنية على التواصل والاحترام. نصائح باش تحسن علاقاتك: تعلم تسمع مليح، عبر على مشاعرك بوضوح، حط حدود صحية، تقبل الاختلاف، وأطلب مساعدة مختصة كان لزم.',
    'relationships', 5
  ),
  (
    'تعزيز تقدير الذات',
    'Renforcer l''estime de soi',
    'كيفاش تعزز تقديرك لروحك',
    'تقدير الذات هو الأساس لصحة نفسية جيدة. خطوات لتعزيزه: حدد نقاط قوتك واكتبها، توقف عن مقارنة نفسك بالآخرين، احتفل بإنجازاتك مهما كانت صغيرة، تعامل مع نفسك بلطف، وتذكر أنك تستحق الحب والاحترام.',
    'L''estime de soi est la base d''une bonne santé mentale. Étapes pour la renforcer : identifiez vos points forts et notez-les, arrêtez de vous comparer aux autres, célébrez vos réussites même petites, traitez-vous avec bienveillance.',
    'تقدير الذات هو الأساس للصحة النفسية الباهية. خطوات باش تعززو: حدد نقاط قوتك واكتبهم، وقف تقارن روحك بالناس، احتفل بنجاحاتك كي ما كانت صغيرة، تعامل مع روحك بلطف.',
    'self_esteem', 4
  ),
  (
    'التعامل مع الحزن والفقدان',
    'Faire face au deuil et à la perte',
    'كيفاش تتعامل مع الحزن والفقدان',
    'الحزن هو استجابة طبيعية للفقدان. مراحل الحزن تختلف من شخص لآخر، ولا توجد طريقة "صحيحة" للحداد. اسمح لنفسك بالشعور، لا تكبت مشاعرك، تحدث عن خسارتك، حافظ على روتينك اليومي، وتذكر أن طلب المساعدة المهنية ليس ضعفاً.',
    'Le deuil est une réponse naturelle à la perte. Les étapes du deuil varient d''une personne à l''autre, et il n''y a pas de "bonne" façon de faire son deuil. Permettez-vous de ressentir, ne refoulez pas vos émotions, parlez de votre perte, maintenez votre routine quotidienne.',
    'الحزن حاجة طبيعية كي تخسر شي حد وإلا شي حاجة. كل واحد يحزن بطريقتو، ما فماش طريقة وحدة صحيحة. خلي روحك تحس، ما تكبتش مشاعرك، أحكي على خسارتك، حافظ على روتينك اليومي.',
    'grief', 6
  )
on conflict do nothing;
