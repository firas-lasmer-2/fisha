-- Shifa: Seed Data
-- Note: In production, therapist users are created through Supabase Auth signup.
-- This seed assumes the auth.users entries exist. For development, you may need to
-- create auth users first via the Supabase dashboard or auth API, then run this seed.

-- Seed resources (these don't require auth users)
insert into public.resources (title_ar, title_fr, title_darija, content_ar, content_fr, content_darija, category, read_time_minutes)
values
  (
    'كيف تتعامل مع نوبات القلق',
    'Comment gérer les crises d''anxiété',
    'كيفاش تتعامل مع نوبات القلق',
    'القلق هو استجابة طبيعية للضغوط، لكن عندما يصبح مفرطاً يمكن أن يؤثر على حياتك اليومية. إليك خطوات عملية للتعامل مع نوبات القلق: أولاً، تعلم تقنية التنفس العميق - استنشق لمدة 4 ثوانٍ، احبس نفسك لمدة 7 ثوانٍ، ثم ازفر لمدة 8 ثوانٍ. ثانياً، مارس تقنية التأريض بالحواس الخمس. ثالثاً، تحدث مع شخص تثق به.',
    'L''anxiété est une réponse naturelle au stress, mais quand elle devient excessive, elle peut affecter votre vie quotidienne. Voici des étapes pratiques pour gérer les crises d''anxiété : Premièrement, apprenez la technique de respiration profonde - inspirez pendant 4 secondes, retenez pendant 7 secondes, puis expirez pendant 8 secondes. Deuxièmement, pratiquez la technique d''ancrage par les 5 sens. Troisièmement, parlez à quelqu''un en qui vous avez confiance.',
    'القلق حاجة طبيعية كي تكون تحت الضغط، اما كي يولي برشا ينجم يأثر على حياتك. هاذي شوية نصائح: أولاً تعلم تتنفس بعمق - شهق 4 ثواني، وقف 7 ثواني، وزفر 8 ثواني. ثانياً خدم تقنية التأريض بالحواس الخمسة. ثالثاً أحكي مع شخص تثق فيه.',
    'anxiety',
    5
  ),
  (
    'فهم الاكتئاب: أعراضه وعلاجه',
    'Comprendre la dépression : symptômes et traitement',
    'فهم الاكتئاب: شنوما أعراضو وعلاجو',
    'الاكتئاب ليس مجرد شعور بالحزن، بل هو حالة صحية تحتاج إلى عناية مهنية. من أعراضه: فقدان الاهتمام بالأنشطة، تغير في النوم والشهية، صعوبة في التركيز، والشعور بالذنب أو عدم القيمة. العلاج متاح وفعال، ويشمل العلاج النفسي والأدوية عند الحاجة. لا تتردد في طلب المساعدة.',
    'La dépression n''est pas simplement un sentiment de tristesse, c''est un état de santé qui nécessite une attention professionnelle. Parmi ses symptômes : perte d''intérêt pour les activités, changements dans le sommeil et l''appétit, difficulté de concentration, et sentiment de culpabilité ou d''inutilité. Le traitement est disponible et efficace, incluant la psychothérapie et les médicaments si nécessaire.',
    'الاكتئاب مش حزن عادي، هو حالة صحية تحتاج عناية مختصة. من أعراضو: ما عندكش خاطر تعمل حاجة، النوم يتبدل، الماكلة تتبدل، صعوبة التركيز. العلاج موجود ويخدم، فيه العلاج النفسي والأدوية كان لزم. ما تخافش تطلب مساعدة.',
    'depression',
    7
  ),
  (
    'تقنيات إدارة الضغوط اليومية',
    'Techniques de gestion du stress quotidien',
    'تقنيات باش تتعامل مع الضغط النفسي',
    'الضغط النفسي جزء من الحياة اليومية، خاصة في ظل التحديات الاقتصادية والاجتماعية. إليك تقنيات فعالة: 1. مارس التأمل لمدة 10 دقائق يومياً 2. حافظ على نشاط بدني منتظم 3. نظم وقتك وحدد أولوياتك 4. تعلم أن تقول "لا" 5. خصص وقتاً للأنشطة الممتعة 6. تواصل مع العائلة والأصدقاء',
    'Le stress fait partie de la vie quotidienne, surtout face aux défis économiques et sociaux. Voici des techniques efficaces : 1. Pratiquez la méditation 10 minutes par jour 2. Maintenez une activité physique régulière 3. Organisez votre temps et définissez vos priorités 4. Apprenez à dire "non" 5. Consacrez du temps aux activités plaisantes 6. Restez en contact avec la famille et les amis',
    'الضغط حاجة عادية في حياتنا، خاصة مع التحديات الاقتصادية والاجتماعية. هاذي تقنيات تنفعك: 1. اعمل تأمل 10 دقايق كل يوم 2. اعمل رياضة 3. نظم وقتك 4. تعلم تقول "لا" 5. خصص وقت للحوايج الباهية 6. تواصل مع العايلة والأصحاب',
    'stress',
    6
  ),
  (
    'بناء علاقات صحية',
    'Construire des relations saines',
    'كيفاش تبني علاقات صحية',
    'العلاقات الصحية مبنية على التواصل والاحترام المتبادل. نصائح لتحسين علاقاتك: تعلم الاستماع الفعال، عبر عن مشاعرك بوضوح، ضع حدوداً صحية، تقبل الاختلاف، واطلب المساعدة المهنية عند الحاجة. تذكر أن العلاقة الجيدة تتطلب عملاً مستمراً من الطرفين.',
    'Les relations saines sont fondées sur la communication et le respect mutuel. Conseils pour améliorer vos relations : apprenez l''écoute active, exprimez vos sentiments clairement, établissez des limites saines, acceptez les différences, et demandez une aide professionnelle si nécessaire.',
    'العلاقات الباهية مبنية على التواصل والاحترام. نصائح باش تحسن علاقاتك: تعلم تسمع مليح، عبر على مشاعرك بوضوح، حط حدود صحية، تقبل الاختلاف، وأطلب مساعدة مختصة كان لزم.',
    'relationships',
    5
  ),
  (
    'تعزيز تقدير الذات',
    'Renforcer l''estime de soi',
    'كيفاش تعزز تقديرك لروحك',
    'تقدير الذات هو الأساس لصحة نفسية جيدة. خطوات لتعزيزه: حدد نقاط قوتك واكتبها، توقف عن مقارنة نفسك بالآخرين، احتفل بإنجازاتك مهما كانت صغيرة، تعامل مع نفسك بلطف، وتذكر أنك تستحق الحب والاحترام.',
    'L''estime de soi est la base d''une bonne santé mentale. Étapes pour la renforcer : identifiez vos points forts et notez-les, arrêtez de vous comparer aux autres, célébrez vos réussites même petites, traitez-vous avec bienveillance.',
    'تقدير الذات هو الأساس للصحة النفسية الباهية. خطوات باش تعززو: حدد نقاط قوتك واكتبهم، وقف تقارن روحك بالناس، احتفل بنجاحاتك كي ما كانت صغيرة، تعامل مع روحك بلطف.',
    'self_esteem',
    4
  ),
  (
    'التعامل مع الحزن والفقدان',
    'Faire face au deuil et à la perte',
    'كيفاش تتعامل مع الحزن والفقدان',
    'الحزن هو استجابة طبيعية للفقدان. مراحل الحزن تختلف من شخص لآخر، ولا توجد طريقة "صحيحة" للحداد. اسمح لنفسك بالشعور، لا تكبت مشاعرك، تحدث عن خسارتك، حافظ على روتينك اليومي، وتذكر أن طلب المساعدة المهنية ليس ضعفاً.',
    'Le deuil est une réponse naturelle à la perte. Les étapes du deuil varient d''une personne à l''autre, et il n''y a pas de "bonne" façon de faire son deuil. Permettez-vous de ressentir, ne refoulez pas vos émotions, parlez de votre perte, maintenez votre routine quotidienne.',
    'الحزن حاجة طبيعية كي تخسر شي حد وإلا شي حاجة. كل واحد يحزن بطريقتو، ما فماش طريقة وحدة صحيحة. خلي روحك تحس، ما تكبتش مشاعرك، أحكي على خسارتك، حافظ على روتينك اليومي.',
    'grief',
    6
  )
on conflict do nothing;
