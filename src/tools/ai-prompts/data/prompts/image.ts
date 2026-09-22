import type { PromptItem } from '../../types';

/** 图像与绘画提示词类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'image-photorealistic-portrait',
    category: 'image',
    title: { zh: '写实人像', en: 'Photorealistic portrait' },
    prompt: {
      zh: '构建写实人像的生成提示词：主体（年龄、外貌、表情）、光线（方向、质感）、镜头（焦段、光圈、景深）、背景、整体色调。请输出一段可直接使用的英文提示词，并附中文说明。',
      en: 'Build a prompt for a photorealistic portrait: subject (age, appearance, expression), lighting (direction, quality), lens (focal length, aperture, depth of field), background, and overall color grade. Output a ready-to-use English prompt plus a short explanation.',
    },
  },
  {
    id: 'image-illustration-style',
    category: 'image',
    title: { zh: '插画风格', en: 'Illustration style' },
    prompt: {
      zh: '为「{{subject}}」生成插画提示词：指定风格（线稿 / 水彩 / 扁平 / 厚涂 / 动漫）、配色、构图、笔触质感，并附 3 个风格变体关键词。',
      en: 'Write an illustration prompt for "{{subject}}": specify the style (line art / watercolor / flat / painterly / anime), palette, composition, and brush texture, plus 3 style-variant keywords.',
    },
  },
  {
    id: 'image-poster-visual',
    category: 'image',
    title: { zh: '海报画面', en: 'Poster visual' },
    prompt: {
      zh: '为「{{theme}}」设计海报画面的图像提示词：主视觉元素、构图与留白位置（便于后期加文字）、色彩情绪、画面比例，并说明视觉焦点落在哪里。',
      en: 'Write an image prompt for a poster about "{{theme}}": the key visual, composition with negative space reserved for later text, color mood, aspect ratio, and where the visual focus lands.',
    },
  },
  {
    id: 'image-product-scene',
    category: 'image',
    title: { zh: '产品场景图', en: 'Product scene' },
    prompt: {
      zh: '为「{{product}}」生成产品场景图提示词：材质与质感、场景环境、道具搭配、光线与阴影、镜头角度。输出英文提示词，并说明如何保持品牌视觉一致性。',
      en: 'Write a product scene prompt for "{{product}}": material and texture, environment, props, light and shadow, and camera angle. Output the English prompt and explain how to keep it on-brand.',
    },
  },
  {
    id: 'image-character-design',
    category: 'image',
    title: { zh: '角色设定', en: 'Character design' },
    prompt: {
      zh: '为「{{character}}」做角色设定提示词：外形特征（发型 / 服装 / 配饰 / 体态）、性格如何体现在视觉上、3 个不同情绪的版本，以及保持角色一致性的关键词写法。',
      en: 'Write a character design prompt for "{{character}}": appearance (hair / outfit / accessories / build), how personality shows visually, 3 versions with different emotions, and how to phrase keywords for character consistency.',
    },
  },
  {
    id: 'image-landscape-scene',
    category: 'image',
    title: { zh: '场景与风景', en: 'Landscape scene' },
    prompt: {
      zh: '生成「{{scene}}」的场景提示词：时间与天气、地形与植被、天空与云层、前景中景远景的层次、镜头参数与色调。',
      en: 'Write a scene prompt for "{{scene}}": time of day and weather, terrain and vegetation, sky and clouds, foreground / midground / background layers, camera parameters, and color grade.',
    },
  },
  {
    id: 'image-icon-sticker',
    category: 'image',
    title: { zh: '图标与贴纸', en: 'Icon and sticker' },
    prompt: {
      zh: '为「{{concept}}」生成图标或贴纸提示词：简洁造型、描边粗细、圆角程度、配色数量限制、纯色背景要求，并说明如何保证小尺寸下仍可辨识。',
      en: 'Write an icon or sticker prompt for "{{concept}}": simple shapes, stroke weight, corner radius, a limited color count, and a solid background requirement. Explain how to keep it legible at small sizes.',
    },
  },
  {
    id: 'image-text-in-image',
    category: 'image',
    title: { zh: '图内文字', en: 'Text inside the image' },
    prompt: {
      zh: '我需要生成一张带文字的图，文字内容是「{{text}}」。请写提示词并说明：字体风格、文字在画面中的位置与层级、如何降低模型拼错字的概率，以及拼错后的补救方案。',
      en: 'I need an image containing the text "{{text}}". Write the prompt and explain the font style, the placement and hierarchy of the text, how to reduce the chance of misspelling, and how to fix it when it happens.',
    },
  },
  {
    id: 'image-lighting-mood',
    category: 'image',
    title: { zh: '光影与氛围', en: 'Lighting and mood' },
    prompt: {
      zh: '为已有画面调整氛围，请给出 3 种光影设置的提示词方案（如黄金时刻侧逆光 / 阴天柔光 / 霓虹夜景），各说明色温、对比度与情绪效果。',
      en: 'Give prompt options for changing the mood of an existing image: 3 lighting setups (e.g. golden-hour rim light / overcast soft light / neon night), each with color temperature, contrast, and emotional effect.',
    },
  },
  {
    id: 'image-camera-language',
    category: 'image',
    title: { zh: '镜头语言', en: 'Camera language' },
    prompt: {
      zh: '为「{{subject}}」指定镜头语言的提示词：焦段（广角 / 标准 / 长焦）、光圈与景深、机位高度与角度、透视效果，并说明各自的视觉感受。',
      en: 'Write camera-language keywords for "{{subject}}": focal length (wide / normal / telephoto), aperture and depth of field, camera height and angle, and perspective effect, explaining how each feels visually.',
    },
  },
  {
    id: 'image-style-rewrite',
    category: 'image',
    title: { zh: '风格改写', en: 'Style rewrite' },
    prompt: {
      zh: '把下面这段描述改写成「{{style}}」风格的图像提示词：保留原始主体与场景信息，替换风格关键词与笔触描述。原描述：\n\n{{text}}',
      en: 'Rewrite the description below as an image prompt in "{{style}}" style: keep the original subject and scene, and replace the style keywords and texture language. Original:\n\n{{text}}',
    },
  },
  {
    id: 'image-negative-prompt',
    category: 'image',
    title: { zh: '负面提示词', en: 'Negative prompts' },
    prompt: {
      zh: '为「{{subject}}」整理负面提示词：按类别分组列出常见缺陷（多余手指、文字水印、变形、过曝等）与不想要的风格，并说明哪些负面词可能过度抑制画面表现。',
      en: 'Build negative prompts for "{{subject}}": list common defects (extra fingers, watermarks, distortion, overexposure) and unwanted styles, grouped by category, and note which negatives may over-suppress the result.',
    },
  },
];
