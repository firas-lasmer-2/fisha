import { db } from "./db";
import { users, therapistProfiles, resources, therapistReviews } from "@shared/schema";
import { sql, eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  const therapistUsers = [
    {
      id: "therapist-1",
      email: "dr.amira@shifa.tn",
      firstName: "أميرة",
      lastName: "بن سالم",
      role: "therapist",
      languagePreference: "ar",
      governorate: "tunis",
      bio: "معالجة نفسية متخصصة في القلق والاكتئاب مع 10 سنوات خبرة",
      profileImageUrl: null,
    },
    {
      id: "therapist-2",
      email: "dr.mehdi@shifa.tn",
      firstName: "مهدي",
      lastName: "الجزيري",
      role: "therapist",
      languagePreference: "fr",
      governorate: "sfax",
      bio: "Psychologue clinicien spécialisé dans la thérapie cognitive comportementale",
      profileImageUrl: null,
    },
    {
      id: "therapist-3",
      email: "dr.salma@shifa.tn",
      firstName: "سلمى",
      lastName: "العياري",
      role: "therapist",
      languagePreference: "ar",
      governorate: "sousse",
      bio: "متخصصة في العلاقات الأسرية والزوجية والصدمات النفسية",
      profileImageUrl: null,
    },
    {
      id: "therapist-4",
      email: "dr.karim@shifa.tn",
      firstName: "Karim",
      lastName: "Bouaziz",
      role: "therapist",
      languagePreference: "fr",
      governorate: "tunis",
      bio: "Thérapeute spécialisé en gestion du stress et burnout professionnel",
      profileImageUrl: null,
    },
    {
      id: "therapist-5",
      email: "dr.fatma@shifa.tn",
      firstName: "فاطمة",
      lastName: "الشريف",
      role: "therapist",
      languagePreference: "ar",
      governorate: "bizerte",
      bio: "معالجة نفسية متخصصة في صدمات الطفولة وتقدير الذات",
      profileImageUrl: null,
    },
    {
      id: "therapist-6",
      email: "dr.nabil@shifa.tn",
      firstName: "Nabil",
      lastName: "Trabelsi",
      role: "therapist",
      languagePreference: "fr",
      governorate: "monastir",
      bio: "Psychiatre avec expertise en troubles anxieux et dépression majeure",
      profileImageUrl: null,
    },
  ];

  for (const u of therapistUsers) {
    await db.insert(users).values(u).onConflictDoNothing();
  }

  const profiles = [
    {
      userId: "therapist-1",
      licenseNumber: "TN-PSY-2015-001",
      specializations: ["anxiety", "depression", "stress"],
      languages: ["ar", "darija", "fr"],
      rateDinar: 80,
      verified: true,
      rating: 4.8,
      reviewCount: 127,
      yearsExperience: 10,
      education: "دكتوراه في علم النفس السريري - جامعة تونس",
      approach: "العلاج المعرفي السلوكي",
      availableDays: ["monday", "tuesday", "wednesday", "thursday"],
      availableHoursStart: "09:00",
      availableHoursEnd: "17:00",
      acceptsOnline: true,
      acceptsInPerson: true,
      officeAddress: "شارع الحبيب بورقيبة، تونس العاصمة",
      gender: "female",
      slug: "dr-amira",
      headline: "مساعدتك في إيجاد السلام الداخلي",
      aboutMe: "أنا معالجة نفسية متخصصة في القلق والاكتئاب مع أكثر من 10 سنوات من الخبرة في مساعدة الناس على التغلب على تحدياتهم النفسية. أؤمن بأن كل شخص يستحق الصحة النفسية الجيدة وأعمل مع مرضاي لبناء مهارات التأقلم والمرونة النفسية.",
      acceptingNewClients: true,
      faqItems: [
        { question: "كم تستغرق الجلسة؟", answer: "تستغرق الجلسة 50 دقيقة عادة." },
        { question: "هل تقبلين مرضى جدد؟", answer: "نعم، أقبل مرضى جدد حاليا." },
        { question: "ما هي طريقة العلاج المستخدمة؟", answer: "أستخدم العلاج المعرفي السلوكي بشكل أساسي مع تقنيات أخرى حسب الحاجة." }
      ],
      socialLinks: { facebook: "dr.amira.bensalem", instagram: "dr.amira_psy" },
    },
    {
      userId: "therapist-2",
      licenseNumber: "TN-PSY-2012-042",
      specializations: ["depression", "self_esteem", "addiction"],
      languages: ["fr", "ar", "darija"],
      rateDinar: 100,
      verified: true,
      rating: 4.6,
      reviewCount: 89,
      yearsExperience: 13,
      education: "Doctorat en Psychologie Clinique - Université de Sfax",
      approach: "Thérapie cognitivo-comportementale, EMDR",
      availableDays: ["monday", "wednesday", "friday"],
      availableHoursStart: "10:00",
      availableHoursEnd: "18:00",
      acceptsOnline: true,
      acceptsInPerson: true,
      officeAddress: "Avenue Habib Bourguiba, Sfax",
      gender: "male",
      slug: "dr-mehdi",
      headline: "Votre bien-etre mental est ma priorite",
      aboutMe: "Psychologue clinicien avec 13 ans d'experience, je me specialise dans le traitement de la depression et des troubles de l'estime de soi. Mon approche combine la TCC et l'EMDR pour offrir un traitement personnalise et efficace.",
      acceptingNewClients: true,
      faqItems: [
        { question: "Combien dure une seance?", answer: "Une seance dure generalement 50 minutes." },
        { question: "Proposez-vous des seances en ligne?", answer: "Oui, je propose des seances en visioconference." }
      ],
    },
    {
      userId: "therapist-3",
      licenseNumber: "TN-PSY-2018-015",
      specializations: ["relationships", "family", "couples", "trauma"],
      languages: ["ar", "darija"],
      rateDinar: 70,
      verified: true,
      rating: 4.9,
      reviewCount: 64,
      yearsExperience: 7,
      education: "ماجستير في العلاج النفسي الأسري - جامعة سوسة",
      approach: "العلاج النظامي والأسري",
      availableDays: ["tuesday", "thursday", "saturday"],
      availableHoursStart: "08:00",
      availableHoursEnd: "16:00",
      acceptsOnline: true,
      acceptsInPerson: false,
      gender: "female",
      slug: "dr-salma",
      headline: "بناء علاقات أقوى وأصح",
      aboutMe: "متخصصة في العلاقات الأسرية والزوجية والصدمات النفسية. أساعد الأفراد والأسر على بناء تواصل أفضل وحل النزاعات بطريقة صحية.",
      acceptingNewClients: true,
      faqItems: [
        { question: "هل تعملين مع الأزواج؟", answer: "نعم، أقدم جلسات فردية وجلسات للأزواج والعائلات." }
      ],
    },
    {
      userId: "therapist-4",
      licenseNumber: "TN-PSY-2016-028",
      specializations: ["stress", "anxiety", "self_esteem"],
      languages: ["fr", "ar"],
      rateDinar: 90,
      verified: true,
      rating: 4.5,
      reviewCount: 52,
      yearsExperience: 9,
      education: "Master en Psychologie du Travail - Université de Tunis",
      approach: "Approche intégrative, mindfulness",
      availableDays: ["monday", "tuesday", "thursday", "friday"],
      availableHoursStart: "09:00",
      availableHoursEnd: "19:00",
      acceptsOnline: true,
      acceptsInPerson: true,
      officeAddress: "Rue de Marseille, Tunis",
      gender: "male",
      slug: "dr-karim",
      headline: "Retrouvez votre equilibre interieur",
      aboutMe: "Specialise en gestion du stress et burnout professionnel. J'utilise une approche integrative combinant mindfulness et techniques cognitives pour aider mes patients a retrouver leur equilibre.",
      acceptingNewClients: true,
    },
    {
      userId: "therapist-5",
      licenseNumber: "TN-PSY-2019-033",
      specializations: ["trauma", "self_esteem", "grief"],
      languages: ["ar", "darija"],
      rateDinar: 60,
      verified: true,
      rating: 4.7,
      reviewCount: 38,
      yearsExperience: 6,
      education: "ماجستير في علم النفس العيادي - جامعة بنزرت",
      approach: "العلاج بالتعرض، EMDR",
      availableDays: ["monday", "wednesday", "thursday", "saturday"],
      availableHoursStart: "10:00",
      availableHoursEnd: "17:00",
      acceptsOnline: true,
      acceptsInPerson: true,
      officeAddress: "شارع الثورة، بنزرت",
      gender: "female",
      slug: "dr-fatma",
      headline: "الشفاء يبدأ من هنا",
      aboutMe: "معالجة نفسية متخصصة في صدمات الطفولة وتقدير الذات. أستخدم تقنية EMDR والعلاج بالتعرض لمساعدة مرضاي على التعافي.",
      acceptingNewClients: true,
    },
    {
      userId: "therapist-6",
      licenseNumber: "TN-PSY-2010-007",
      specializations: ["anxiety", "depression", "addiction"],
      languages: ["fr", "ar", "darija"],
      rateDinar: 120,
      verified: true,
      rating: 4.4,
      reviewCount: 145,
      yearsExperience: 15,
      education: "Doctorat en Psychiatrie - Université de Monastir",
      approach: "Pharmacothérapie et psychothérapie intégrative",
      availableDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      availableHoursStart: "08:00",
      availableHoursEnd: "16:00",
      acceptsOnline: true,
      acceptsInPerson: true,
      officeAddress: "Avenue Habib Bourguiba, Monastir",
      gender: "male",
      slug: "dr-nabil",
      headline: "Une approche globale de la sante mentale",
      aboutMe: "Psychiatre avec 15 ans d'experience, je combine pharmacotherapie et psychotherapie pour un traitement complet. Mon approche integrative vise a traiter la personne dans sa globalite.",
      acceptingNewClients: false,
      faqItems: [
        { question: "Prescrivez-vous des medicaments?", answer: "Oui, en tant que psychiatre, je peux prescrire des medicaments quand necessaire, toujours en complement d'un suivi psychotherapeutique." }
      ],
    },
  ];

  for (const p of profiles) {
    const existing = await db.select().from(therapistProfiles).where(eq(therapistProfiles.userId, p.userId));
    if (existing.length === 0) {
      await db.insert(therapistProfiles).values(p);
    } else {
      await db.update(therapistProfiles)
        .set({
          slug: p.slug,
          headline: p.headline,
          aboutMe: p.aboutMe,
          acceptingNewClients: p.acceptingNewClients,
          faqItems: (p as any).faqItems || null,
          socialLinks: (p as any).socialLinks || null,
        })
        .where(eq(therapistProfiles.userId, p.userId));
    }
  }

  const resourceData = [
    {
      titleAr: "كيف تتعامل مع نوبات القلق",
      titleFr: "Comment gérer les crises d'anxiété",
      titleDarija: "كيفاش تتعامل مع نوبات القلق",
      contentAr: "القلق هو استجابة طبيعية للضغوط، لكن عندما يصبح مفرطاً يمكن أن يؤثر على حياتك اليومية. إليك خطوات عملية للتعامل مع نوبات القلق: أولاً، تعلم تقنية التنفس العميق - استنشق لمدة 4 ثوانٍ، احبس نفسك لمدة 7 ثوانٍ، ثم ازفر لمدة 8 ثوانٍ. ثانياً، مارس تقنية التأريض بالحواس الخمس. ثالثاً، تحدث مع شخص تثق به.",
      contentFr: "L'anxiété est une réponse naturelle au stress, mais quand elle devient excessive, elle peut affecter votre vie quotidienne. Voici des étapes pratiques pour gérer les crises d'anxiété : Premièrement, apprenez la technique de respiration profonde - inspirez pendant 4 secondes, retenez pendant 7 secondes, puis expirez pendant 8 secondes. Deuxièmement, pratiquez la technique d'ancrage par les 5 sens. Troisièmement, parlez à quelqu'un en qui vous avez confiance.",
      contentDarija: "القلق حاجة طبيعية كي تكون تحت الضغط، اما كي يولي برشا ينجم يأثر على حياتك. هاذي شوية نصائح: أولاً تعلم تتنفس بعمق - شهق 4 ثواني، وقف 7 ثواني، وزفر 8 ثواني. ثانياً خدم تقنية التأريض بالحواس الخمسة. ثالثاً أحكي مع شخص تثق فيه.",
      category: "anxiety",
      readTimeMinutes: 5,
    },
    {
      titleAr: "فهم الاكتئاب: أعراضه وعلاجه",
      titleFr: "Comprendre la dépression : symptômes et traitement",
      titleDarija: "فهم الاكتئاب: شنوما أعراضو وعلاجو",
      contentAr: "الاكتئاب ليس مجرد شعور بالحزن، بل هو حالة صحية تحتاج إلى عناية مهنية. من أعراضه: فقدان الاهتمام بالأنشطة، تغير في النوم والشهية، صعوبة في التركيز، والشعور بالذنب أو عدم القيمة. العلاج متاح وفعال، ويشمل العلاج النفسي والأدوية عند الحاجة. لا تتردد في طلب المساعدة.",
      contentFr: "La dépression n'est pas simplement un sentiment de tristesse, c'est un état de santé qui nécessite une attention professionnelle. Parmi ses symptômes : perte d'intérêt pour les activités, changements dans le sommeil et l'appétit, difficulté de concentration, et sentiment de culpabilité ou d'inutilité. Le traitement est disponible et efficace, incluant la psychothérapie et les médicaments si nécessaire.",
      contentDarija: "الاكتئاب مش حزن عادي، هو حالة صحية تحتاج عناية مختصة. من أعراضو: ما عندكش خاطر تعمل حاجة، النوم يتبدل، الماكلة تتبدل، صعوبة التركيز. العلاج موجود ويخدم، فيه العلاج النفسي والأدوية كان لزم. ما تخافش تطلب مساعدة.",
      category: "depression",
      readTimeMinutes: 7,
    },
    {
      titleAr: "تقنيات إدارة الضغوط اليومية",
      titleFr: "Techniques de gestion du stress quotidien",
      titleDarija: "تقنيات باش تتعامل مع الضغط النفسي",
      contentAr: "الضغط النفسي جزء من الحياة اليومية، خاصة في ظل التحديات الاقتصادية والاجتماعية. إليك تقنيات فعالة: 1. مارس التأمل لمدة 10 دقائق يومياً 2. حافظ على نشاط بدني منتظم 3. نظم وقتك وحدد أولوياتك 4. تعلم أن تقول \"لا\" 5. خصص وقتاً للأنشطة الممتعة 6. تواصل مع العائلة والأصدقاء",
      contentFr: "Le stress fait partie de la vie quotidienne, surtout face aux défis économiques et sociaux. Voici des techniques efficaces : 1. Pratiquez la méditation 10 minutes par jour 2. Maintenez une activité physique régulière 3. Organisez votre temps et définissez vos priorités 4. Apprenez à dire \"non\" 5. Consacrez du temps aux activités plaisantes 6. Restez en contact avec la famille et les amis",
      contentDarija: "الضغط حاجة عادية في حياتنا، خاصة مع التحديات الاقتصادية والاجتماعية. هاذي تقنيات تنفعك: 1. اعمل تأمل 10 دقايق كل يوم 2. اعمل رياضة 3. نظم وقتك 4. تعلم تقول \"لا\" 5. خصص وقت للحوايج الباهية 6. تواصل مع العايلة والأصحاب",
      category: "stress",
      readTimeMinutes: 6,
    },
    {
      titleAr: "بناء علاقات صحية",
      titleFr: "Construire des relations saines",
      titleDarija: "كيفاش تبني علاقات صحية",
      contentAr: "العلاقات الصحية مبنية على التواصل والاحترام المتبادل. نصائح لتحسين علاقاتك: تعلم الاستماع الفعال، عبر عن مشاعرك بوضوح، ضع حدوداً صحية، تقبل الاختلاف، واطلب المساعدة المهنية عند الحاجة. تذكر أن العلاقة الجيدة تتطلب عملاً مستمراً من الطرفين.",
      contentFr: "Les relations saines sont fondées sur la communication et le respect mutuel. Conseils pour améliorer vos relations : apprenez l'écoute active, exprimez vos sentiments clairement, établissez des limites saines, acceptez les différences, et demandez une aide professionnelle si nécessaire.",
      contentDarija: "العلاقات الباهية مبنية على التواصل والاحترام. نصائح باش تحسن علاقاتك: تعلم تسمع مليح، عبر على مشاعرك بوضوح، حط حدود صحية، تقبل الاختلاف، وأطلب مساعدة مختصة كان لزم.",
      category: "relationships",
      readTimeMinutes: 5,
    },
    {
      titleAr: "تعزيز تقدير الذات",
      titleFr: "Renforcer l'estime de soi",
      titleDarija: "كيفاش تعزز تقديرك لروحك",
      contentAr: "تقدير الذات هو الأساس لصحة نفسية جيدة. خطوات لتعزيزه: حدد نقاط قوتك واكتبها، توقف عن مقارنة نفسك بالآخرين، احتفل بإنجازاتك مهما كانت صغيرة، تعامل مع نفسك بلطف، وتذكر أنك تستحق الحب والاحترام.",
      contentFr: "L'estime de soi est la base d'une bonne santé mentale. Étapes pour la renforcer : identifiez vos points forts et notez-les, arrêtez de vous comparer aux autres, célébrez vos réussites même petites, traitez-vous avec bienveillance.",
      contentDarija: "تقدير الذات هو الأساس للصحة النفسية الباهية. خطوات باش تعززو: حدد نقاط قوتك واكتبهم، وقف تقارن روحك بالناس، احتفل بنجاحاتك كي ما كانت صغيرة، تعامل مع روحك بلطف.",
      category: "self_esteem",
      readTimeMinutes: 4,
    },
    {
      titleAr: "التعامل مع الحزن والفقدان",
      titleFr: "Faire face au deuil et à la perte",
      titleDarija: "كيفاش تتعامل مع الحزن والفقدان",
      contentAr: "الحزن هو استجابة طبيعية للفقدان. مراحل الحزن تختلف من شخص لآخر، ولا توجد طريقة \"صحيحة\" للحداد. اسمح لنفسك بالشعور، لا تكبت مشاعرك، تحدث عن خسارتك، حافظ على روتينك اليومي، وتذكر أن طلب المساعدة المهنية ليس ضعفاً.",
      contentFr: "Le deuil est une réponse naturelle à la perte. Les étapes du deuil varient d'une personne à l'autre, et il n'y a pas de \"bonne\" façon de faire son deuil. Permettez-vous de ressentir, ne refoulez pas vos émotions, parlez de votre perte, maintenez votre routine quotidienne.",
      contentDarija: "الحزن حاجة طبيعية كي تخسر شي حد وإلا شي حاجة. كل واحد يحزن بطريقتو، ما فماش طريقة وحدة صحيحة. خلي روحك تحس، ما تكبتش مشاعرك، أحكي على خسارتك، حافظ على روتينك اليومي.",
      category: "grief",
      readTimeMinutes: 6,
    },
  ];

  for (const r of resourceData) {
    await db.insert(resources).values(r).onConflictDoNothing();
  }

  console.log("Seed completed successfully!");
  process.exit(0);
}

seed().catch(console.error);
