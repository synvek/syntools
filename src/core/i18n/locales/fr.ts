import type { ShellResources } from '../types';

/** fr 文案资源（外壳 + 工具元数据；`tools.*` 见 fr.tools.ts） */
const fr = {
  app: {
    docTitle: 'SynTools · Boîte à outils en ligne',
  },
  header: {
    openMenu: 'Ouvrir le menu',
    searchPlaceholder: 'Rechercher des outils…',
    searchAria: 'Rechercher des outils',
    themeAria: 'Changer de thème',
    langAria: 'Changer de langue',
    downloadAria: "Télécharger l'application de bureau",
    sourceAria: 'Code source',
  },
  sidebar: {
    nav: 'Navigation des outils',
    closeMenu: 'Fermer le menu',
    filter: 'Filtrer les outils',
    filterPlaceholder: 'Filtrer…',
    filterEmpty: 'Aucun outil correspondant',
    categoryActions: 'Actions de catégorie',
    expandAll: 'Développer toutes les catégories',
    collapseAll: 'Replier toutes les catégories',
  },
  home: {
    title: 'Boîte à outils en ligne',
    tagline:
      'Traitement local d’abord ; les données restent dans votre navigateur (CSP, zéro envoi) · Appuyez sur <1>⌘K</1> ou <3>/</3> pour rechercher',
    favorites: 'Favoris',
    recent: 'Récemment utilisés',
    favoriteAria: 'Ajouter aux favoris',
    unfavoriteAria: 'Retirer des favoris',
  },
  search: {
    aria: 'Rechercher des outils',
    placeholder: 'Rechercher des outils (nom / mots-clés)…',
    empty: 'Aucun outil correspondant trouvé',
  },
  categories: {
    file: 'Fichiers',
    media: 'Audio & Vidéo',
    cheatsheet: 'Aide-mémoire',
    advanced: 'Documents et création',
    encoding: 'Encodage',
    text: 'Texte',
    formatting: 'Formatage',
    crypto: 'Crypto et hash',
    datetime: 'Date et heure',
    generator: 'Générateurs',
    network: 'Réseau',
    image: 'Images',
    pdf: 'PDF',
    other: 'Autres',
  },
  common: {
    copy: 'Copier',
    copied: 'Copié',
    clear: 'Effacer',
    discardConfirm:
      "Le document actuel n'est pas enregistré. En créer un nouveau l'abandonnera. Êtes-vous sûr ?",
    swap: 'Échanger',
    newDoc: 'Nouveau document',
    saved: 'Enregistré dans le brouillon local',
    saving: 'Enregistrement automatique après la saisie',
    download: 'Télécharger',
    share: 'Partager',
    shareTooLong: 'Contenu trop long (> 2 Ko), impossible de créer un lien de partage',
    retry: 'Réessayer',
    loading: 'Chargement',
    operation: 'Action',
    encode: 'Encoder',
    decode: 'Décoder',
    result: 'Résultat',
    rawText: 'Texte brut',
    input: 'Entrée',
    output: 'Sortie',
    text: 'Texte',
    file: 'Fichier',
    remove: 'Supprimer',
    bytes: '{{size}} octets',
  },
  io: {
    stats: '{{chars}} caractères / {{bytes}} octets',
    warnLarge: 'Entrée volumineuse (> 500 Ko), le calcul en temps réel peut ralentir',
    overflow:
      'L’entrée dépasse la limite de 5 Mo ; utilisez le mode fichier pour les grands contenus',
  },
  file: {
    hint: 'Glissez-déposez un fichier ici, ou cliquez pour choisir',
    max: 'Max. {{size}}',
    over: 'Le fichier dépasse la limite de {{max}} (actuel {{size}})',
    uploadAria: 'Téléverser un fichier',
    previewAlt: 'Aperçu de {{name}}',
    pages: '{{n}} pages',
    encrypted: 'Chiffré',
  },
  tool: {
    errorTitle: 'Erreur d’exécution de l’outil',
    localBadge: 'Local uniquement',
    serverBadge: 'Serveur requis',
    related: 'Outils associés',
    nextSteps: 'Étapes suivantes',
    openIn: 'Ouvrir dans {{name}}',
    progress: 'Progression {{current}} / {{total}}',
  },
  notFound: {
    message: 'Page ou outil introuvable',
    back: 'Retour à l’accueil',
  },
  pdf: {
    password: 'Mot de passe PDF',
    passwordPlaceholder: 'Saisissez le mot de passe d’ouverture',
    passwordHint: 'Ce PDF est chiffré. Entrez le mot de passe pour continuer.',
    unlock: 'Déverrouiller',
    errors: {
      NEED_PASSWORD: 'Ce PDF est chiffré. Veuillez saisir le mot de passe.',
      WRONG_PASSWORD: 'Mot de passe incorrect. Veuillez réessayer.',
    },
  },
  toolsMeta: {
    'code-editor': {
      name: 'Éditeur de code',
      description:
        'Édition avec coloration syntaxique, formatage par langage, 10 thèmes et export source / HTML / image',
    },
    'video-convert': {
      name: 'Convertisseur vidéo',
      description:
        "Transcodage vidéo WebCodecs d'abord (MP4 / WebM / MKV), repli automatique sur ffmpeg.wasm",
    },
    'video-to-gif': {
      name: 'Vidéo en GIF',
      description: 'Découper une vidéo en GIF animé (100 % navigateur, encodeur intégré)',
    },
    'audio-convert': {
      name: 'Convertisseur audio',
      description:
        "Conversion audio : WAV (natif) et MP3 / M4A / OGG / FLAC (WebCodecs d'abord, repli ffmpeg.wasm)",
    },
    'subtitle-tool': {
      name: 'Convertisseur de sous-titres',
      description: 'Convertir entre SRT / WebVTT avec décalage du temps',
    },
    'git-cheatsheet': {
      name: 'Aide-mémoire Git',
      description: 'Commandes Git courantes classées par catégorie, avec recherche',
    },
    'mime-types': {
      name: 'Types MIME',
      description: 'Table de correspondance extension / type MIME, avec recherche',
    },
    'http-status': {
      name: 'Codes HTTP',
      description: 'Référence des codes de statut HTTP avec classe, nom et signification',
    },
    'id-photo': {
      name: "Photo d'identité",
      description: 'Recadrer aux formats standards (1 pouce, 2 pouces, passeport) avec fond et DPI',
    },
    'image-grid-cut': {
      name: 'Découpe en grille',
      description: 'Découper une image en grille (ex. 3×3) et télécharger chaque tuile',
    },
    'image-ascii': {
      name: 'Image en ASCII',
      description: 'Convertir des images en art ASCII (jeu de caractères, largeur, inversion)',
    },
    'timezone-converter': {
      name: 'Convertisseur de fuseaux',
      description: 'Convertir les heures entre fuseaux IANA avec décalage UTC',
    },
    'tax-loan-calculator': {
      name: 'Prêt / Impôt',
      description:
        "Amortissement de prêt (mensualité constante / capital constant) et estimation d'impôt",
    },
    'unit-converter': {
      name: "Convertisseur d'unités",
      description:
        'Convertir longueur / masse / surface / volume / température / vitesse / données / temps',
    },
    'bulk-rename': {
      name: 'Renommage en lot',
      description:
        'Générer des noms via préfixe/suffixe, remplacement (regex), numérotation, extension et casse',
    },
    'file-split-merge': {
      name: 'Découpe / Fusion',
      description: 'Découper un gros fichier par taille ou nombre, ou fusionner les parties',
    },
    'zip-manager': {
      name: 'Gestionnaire ZIP',
      description: 'Regrouper des fichiers en ZIP, ou inspecter et extraire les entrées (JSZip)',
    },
    barcode: {
      name: 'Générateur de codes-barres',
      description: 'Génère des codes-barres Code 39 / Code 128 / EAN-13 en SVG',
    },
    'id-generator': {
      name: "Générateur d'ID",
      description: 'Génère des ULID / NanoID / Snowflake / ObjectId MongoDB en lot',
    },
    'code-minify': {
      name: 'Minificateur',
      description: 'Minifier CSS / HTML / JS / JSON (CSS via csso ; JS/HTML conservateur)',
    },
    'csv-tool': {
      name: 'Outil CSV',
      description: 'Conversion CSV ↔ JSON avec délimiteur, en-tête et guillemets (RFC 4180)',
    },
    'key-converter': {
      name: 'Conversion de clés',
      description: 'Convertit les clés RSA entre PEM / DER / JWK / OpenSSH (WebCrypto)',
    },
    'rsa-crypto': {
      name: 'Chiffrement RSA',
      description:
        'RSA-OAEP chiffrer/déchiffrer, RSA-PSS signer/vérifier et génération de clés (WebCrypto)',
    },
    'password-hash': {
      name: 'Hash de mot de passe (PBKDF2)',
      description: 'Dérivation PBKDF2 via WebCrypto, avec sel et itérations personnalisés',
    },
    'password-strength': {
      name: 'Force du mot de passe',
      description:
        "Estime la force d'un mot de passe : entropie, jeu de caractères et motifs faibles",
    },
    checksum: {
      name: 'Somme de contrôle',
      description: 'Calcul de CRC-32 / Adler-32 / FNV-1a (100 % navigateur)',
    },
    'encoding-rescue': {
      name: 'Réparation de mojibake',
      description: 'Re-décode le texte corrompu (UTF-8 mal lu) avec GBK / Big5 / Shift-JIS',
    },
    'escape-unescape': {
      name: 'Échappement / Annulation',
      description: 'Échappe et annule JSON / JS / HTML / XML / URL',
    },
    'caesar-cipher': {
      name: 'César / ROT13 / Rail',
      description: 'Chiffre de César, ROT13, Atbash et Rail Fence',
    },
    'morse-code': {
      name: 'Code Morse',
      description: 'Conversion texte/Morse, avec lettres, chiffres et espaces',
    },
    'base-encoding': {
      name: 'Encodeur Base',
      description: 'Encodage/décodage Base16/32/32Hex/58/64/64URL (100 % navigateur)',
    },
    'pdf-compress': {
      name: 'Compression PDF',
      description:
        "Compresse le PDF : flux d'objets sans perte ou réencodage JPEG par page avec perte",
    },
    'pdf-watermark': {
      name: 'Filigrane PDF',
      description: 'Ajoute un filigrane texte au PDF (mosaïque, rotation, opacité, plage de pages)',
    },
    'pdf-decrypt': {
      name: 'Déverrouillage PDF',
      description:
        'Charge avec le mot de passe puis exporte un PDF non protégé (comme qpdf --decrypt)',
    },
    'pdf-extract-text': {
      name: 'Extraction de texte PDF',
      description:
        'Extrait le texte de toutes les pages PDF (local, fichiers chiffrés pris en charge)',
    },
    'random-port': {
      name: 'Port et adresse aléatoires',
      description:
        'Génère ports, IPv4 privée, MAC et IPv6 (déduplication et ports courants évités)',
    },
    'websocket-tester': {
      name: 'Testeur WebSocket',
      description: 'Connexion WebSocket, envoi/réception texte/binaire avec journal',
    },
    'http-request': {
      name: 'Débogueur HTTP',
      description:
        'Envoie des requêtes HTTP dans le navigateur, inspecte statut, durée, en-têtes (CORS)',
    },
    'http-headers': {
      name: "Générateur d'en-têtes de sécurité",
      description: 'Génère CSP / HSTS / Referrer-Policy (nginx / Apache / Express / Vercel)',
    },
    'ua-generator': {
      name: 'Générateur User-Agent',
      description: 'Génère un User-Agent selon le navigateur/OS, avec une bibliothèque',
    },
    'url-parser': {
      name: "Analyseur d'URL",
      description: "Décompose l'URL en protocole, hôte, port, chemin, paramètres et ancre",
    },
    'mac-address': {
      name: "Outil d'adresse MAC",
      description: 'Formatage MAC, recherche de fabricant (OUI), EUI-64 et génération en masse',
    },
    'ip-calc': {
      name: 'Calculateur IP',
      description: 'Adressage IPv4/IPv6, sous-réseaux (VLSM), super-réseau et masque générique',
    },
    'flowchart-editor': {
      name: 'Éditeur de diagrammes',
      description:
        'Créez des diagrammes en local : nœuds, liens, modèles, disposition auto et export PNG/SVG',
    },
    'mindmap-editor': {
      name: 'Éditeur de carte mentale',
      description:
        'Créez des cartes mentales en local : nœuds au clavier, branches repliables, mises en page, thèmes et export PNG/SVG/Markdown',
    },
    'photo-editor': {
      name: 'Éditeur de photo',
      description:
        'Retouche photo multi-calques dans le navigateur : calques, sélections, recadrage, réglages, filtres, pinceau et texte, avec projet rééditable',
    },
    base64: {
      name: 'Encodage / décodage Base64',
      description:
        'Conversion texte ↔ Base64 Unicode-safe ; modes URL Safe et fichier pris en charge',
    },
    'url-codec': {
      name: 'Encodage / décodage URL',
      description:
        'Modes encodeURIComponent / encodeURI avec détection des pourcentages mal formés',
    },
    'regex-tester': {
      name: 'Outil d’expressions régulières',
      description:
        'Surlignage des correspondances, remplacement, groupes de capture, préréglages et aide-mémoire',
    },
    'text-diff': {
      name: 'Différence de texte',
      description:
        'Éditeurs côte à côte avec surlignage de lignes, numéros de ligne et ignore des espaces',
    },
    'json-format': {
      name: 'Formateur JSON',
      description:
        'Formater / minifier / valider avec indentation 2/4 espaces et position d’erreur ligne/colonne',
    },
    'json-convert': {
      name: 'Convertisseur JSON',
      description: 'Analyser du JSON et le convertir en YAML / XML / CSV',
    },
    timestamp: {
      name: 'Convertisseur d’horodatage',
      description: 'Unix ⇄ heure lisible avec détection auto secondes/ms et horloge en direct',
    },
    uuid: {
      name: 'Générateur UUID',
      description:
        'UUID v4 aléatoires / v7 ordonnés dans le temps, sortie par lot et options de format',
    },
    hash: {
      name: 'Calculateur de hash',
      description:
        'MD5 / SHA-1 / SHA-256 / SHA-512 pour texte et fichiers (streaming), sortie hex / base64',
    },
    'jwt-parser': {
      name: 'Analyseur JWT',
      description:
        'Analyser header / payload / signature et lire exp et autres claims temporels (lecture seule, sans vérification)',
    },
    'aes-crypto': {
      name: 'Chiffrement / déchiffrement AES',
      description:
        'AES-GCM avec phrase secrète PBKDF2 ou clé brute ; sortie base64(salt|iv|ciphertext)',
    },
    hmac: {
      name: 'HMAC',
      description: 'HMAC-SHA256 / SHA512 avec sortie hex / base64',
    },
    totp: {
      name: 'TOTP',
      description: 'TOTP RFC 6238 : générer / vérifier, 6/8 chiffres, secondes restantes',
    },
    'x509-decode': {
      name: 'Décodeur de certificat X.509',
      description: 'Analyser PEM : empreintes SHA-256/SHA-1, type, longueur DER, CN',
    },
    'cidr-calc': {
      name: 'Calculateur CIDR',
      description: 'CIDR IPv4 : réseau / diffusion / plage d’hôtes / masque / nombre d’hôtes',
    },
    'text-lines': {
      name: 'Outils de lignes de texte',
      description: 'Trier / dédupliquer / inverser / numéroter / supprimer les lignes vides',
    },
    'hex-codec': {
      name: 'Encodage / décodage Hex',
      description: 'Hex ↔ texte UTF-8 avec espaces optionnels',
    },
    'url-query': {
      name: 'Analyseur de requête URL',
      description: 'Analyser les parties d’URL et les paramètres ; reconstruire après édition',
    },
    'json-path': {
      name: 'Requête JSONPath',
      description: 'Requêtes de chemin simples du type a.b[0].c',
    },
    'gzip-tool': {
      name: 'Compression Gzip',
      description: 'Compresser du texte en Gzip vers base64 / décompresser vers texte',
    },
    'exif-strip': {
      name: 'Supprimer EXIF',
      description: 'Lire l’EXIF JPEG de base et supprimer APP1 ; télécharger le fichier nettoyé',
    },
    'fake-data': {
      name: 'Générateur de fausses données',
      description: 'Générer noms / e-mails / UUID / lorem en zh/en, 1–50 éléments',
    },
    'password-gen': {
      name: 'Générateur de mots de passe',
      description:
        'Mots de passe aléatoires forts avec longueur / jeu de caractères, entropie et force',
    },
    'entity-codec': {
      name: 'Encodage / décodage HTML',
      description:
        'Encoder/décoder les caractères spéciaux HTML : nommés / décimal / hex / échappements \\u',
    },
    'cron-parser': {
      name: 'Analyseur d’expression Cron',
      description:
        'Valider les expressions cron, expliquer les champs et prévisualiser les prochaines exécutions',
    },
    'convert-data': {
      name: 'Convertisseur de formats de config',
      description: 'Convertir YAML ⇄ JSON ⇄ TOML via une valeur JS sans perte',
    },
    'sql-format': {
      name: 'Formateur SQL',
      description:
        'Embellir le SQL multi-dialectes avec indentation et casse des mots-clés configurables',
    },
    'html-format': {
      name: 'Minification / embelliissement HTML',
      description: 'Minifier et embellir le HTML avec indentation 2/4 espaces',
    },
    'js-format': {
      name: 'Minification / embelliissement JS',
      description: 'Minifier et embellir le JavaScript avec indentation 2/4 espaces',
    },
    'css-format': {
      name: 'Minification / embelliissement CSS',
      description: 'Minifier et embellir le CSS avec indentation 2/4 espaces',
    },
    'xml-format': {
      name: 'Minification / embelliissement XML',
      description: 'Embellir et minifier le XML avec indentation 2/4 espaces ; CDATA conservé',
    },
    'xml-json': {
      name: 'XML vers JSON',
      description: 'Analyser le XML en JSON en conservant les attributs avec le préfixe @_',
    },
    qrcode: {
      name: 'Code QR',
      description: 'Générer et décoder des codes QR avec ECC, taille, couleurs et marge',
    },
    'color-converter': {
      name: 'Convertisseur de couleurs',
      description: 'Convertir et prévisualiser les formats HEX / RGB / HSL',
    },
    'radix-converter': {
      name: 'Convertisseur de bases',
      description:
        'Convertir bases 2/8/10/16 et visualiser les opérations bit à bit sur entiers signés 64 bits',
    },
    'markdown-preview': {
      name: 'Éditeur Markdown',
      description:
        'Édition et aperçu en direct, plan, comptage de mots, ouverture/enregistrement .md et export HTML',
    },
    'image-compress': {
      name: 'Compression d’image',
      description:
        'Compression et conversion de format côté client (PNG / JPEG / WebP) avec redimensionnement et qualité',
    },
    'unicode-codec': {
      name: 'Codec Unicode',
      description: 'Convertir texte ↔ \\uXXXX, points de code, entités HTML et octets UTF-8',
    },
    'html-color-picker': {
      name: 'Sélecteur de couleur HTML',
      description:
        'Choisir des couleurs visuellement et exporter HEX / RGB / HSL plus snippets HTML/CSS',
    },
    'web-color-table': {
      name: 'Table des couleurs Web',
      description: 'Couleurs nommées CSS avec filtres par groupe et copie nom / HEX / RGB',
    },
    pinyin: {
      name: 'Chinois vers pinyin',
      description: 'Convertir le chinois en pinyin avec tons, séparateur et casse optionnels',
    },
    'length-converter': {
      name: 'Convertisseur de longueurs',
      description: 'Convertir unités métriques et impériales (mm, cm, m, km, in, ft, etc.)',
    },
    'zh-convert': {
      name: 'Convertisseur chinois traditionnel',
      description: 'Convertir entre chinois simplifié et traditionnel',
    },
    'weight-converter': {
      name: 'Convertisseur de poids',
      description: 'Convertir unités métriques et impériales (mg, g, kg, t, oz, lb, st)',
    },
    'text-counter': {
      name: 'Compteur de texte',
      description: 'Compter caractères, mots, lignes, paragraphes, caractères CJK et octets UTF-8',
    },
    calendar: {
      name: 'Calendrier',
      description:
        'Vue mensuelle avec calendrier lunaire/almanach pour le chinois et jours fériés locaux pour l’anglais',
    },
    'css-button': {
      name: 'Générateur de boutons CSS',
      description: 'Ajuster les styles visuellement et générer CSS / HTML de bouton',
    },
    'random-number': {
      name: 'Générateur de nombres aléatoires',
      description:
        'Générer des entiers ou décimales aléatoires dans une plage, avec unicité optionnelle',
    },
    'random-string': {
      name: 'Générateur de chaînes aléatoires',
      description:
        'Générer des chaînes par longueur et jeu de caractères (alnum / hex / personnalisé)',
    },
    'doodle-board': {
      name: 'Tableau de dessin',
      description:
        'Tableau de dessin dans le navigateur : stylo/surligneur/gomme, formes et polygones, pipette, déplacement et zoom, export multi-format',
    },
    calculator: {
      name: 'Calculatrice',
      description:
        'Calculateur d’expressions sûr : arithmétique, puissance, modulo et fonctions courantes',
    },
    'code-image': {
      name: 'Code vers image',
      description: 'Rendre le code en carte avec coloration syntaxique et exporter en PNG',
    },
    'image-color-picker': {
      name: 'Pipette de couleur d’image',
      description: 'Téléverser une image et cliquer un pixel pour échantillonner HEX / RGB',
    },
    'ascii-table': {
      name: 'Table ASCII',
      description: 'Référence ASCII 0–127 avec recherche par décimal, hex ou caractère',
    },
    'image-watermark': {
      name: 'Filigrane d’image',
      description: 'Ajouter un filigrane texte avec position, opacité, rotation et mosaïque',
    },
    'case-convert': {
      name: 'Convertisseur de casse',
      description: 'Convertir casse et styles de nommage (camel / snake / kebab, etc.)',
    },
    'bmi-calculator': {
      name: 'Calculateur d’IMC',
      description: 'Calculer l’IMC à partir de la taille et du poids avec catégories OMS adultes',
    },
    'placeholder-image': {
      name: 'Image placeholder',
      description: 'Générer un PNG placeholder par taille, couleurs et texte optionnel',
    },
    'image-merge': {
      name: 'Fusion d’images',
      description: 'Assembler des images horizontalement, verticalement ou en grille en un PNG',
    },
    'cron-generator': {
      name: 'Générateur Crontab',
      description:
        'Construire une expression Cron standard à 5 champs depuis minute/heure/jour/mois/jour de semaine',
    },
    'ua-parser': {
      name: 'Analyseur User-Agent',
      description: 'Analyser un User-Agent navigateur en navigateur, moteur, OS et appareil',
    },
    'latex-editor': {
      name: 'Éditeur mathématique LaTeX',
      description: 'Symboles rapides et formules classiques, aperçu KaTeX, export PNG/JPG/SVG',
    },
    countdown: {
      name: 'Minuteur compte à rebours',
      description: 'Régler heures, minutes et secondes ; pause, reprise et alerte de fin',
    },
    stopwatch: {
      name: 'Chronomètre',
      description: 'Chronomètre en ligne avec démarrage, pause, tour et réinitialisation',
    },
    'svg-to-png': {
      name: 'SVG vers PNG',
      description: 'Convertir balisage ou fichiers SVG en PNG avec échelle et transparence',
    },
    'image-frame': {
      name: 'Bordure / rayon / ombre d’image',
      description: 'Ajouter bordure, coins arrondis et ombre, puis exporter en PNG',
    },
    'image-adjust': {
      name: 'Réglage des couleurs d’image',
      description: 'Ajuster luminosité, contraste, saturation et teinte, puis exporter en PNG',
    },
    'gif-frames': {
      name: 'Extracteur de frames GIF',
      description: 'Découper un GIF en frames PNG ; télécharger une ou toutes',
    },
    'image-crop': {
      name: 'Recadrage d’image',
      description: 'Recadrer librement ou avec ratios fixes vers PNG',
    },
    'mbti-test': {
      name: 'Test de personnalité MBTI',
      description: 'Quiz MBTI court de 24 questions (divertissement uniquement)',
    },
    'text-card': {
      name: 'Texte vers carte',
      description: 'Mettre en page titre et corps en carte stylée et exporter en PNG',
    },
    'image-card': {
      name: 'Image vers carte',
      description: 'Carte photo + titre/sous-titre avec arrière-plans ou dégradés, export PNG',
    },
    'code-highlight': {
      name: 'Colorateur de code',
      description: 'Coloration syntaxique en direct avec numéros de ligne et copie de snippet HTML',
    },
    'image-base64': {
      name: 'Image ↔ Base64',
      description: 'Convertir images ↔ Base64 / Data URL, entièrement en local',
    },
    'image-ico': {
      name: 'Convertisseur ICO',
      description:
        'Convertir des images en ICO multi-tailles (favicon), ou extraire PNG depuis ICO',
    },
    'hsv-cmyk': {
      name: 'Convertisseur HSV / CMYK',
      description: 'Convertir et prévisualiser les espaces RGB, HSV, CMYK et HEX',
    },
    'ai-prompts': {
      name: 'Bibliothèque de prompts IA',
      description: 'Prompts sélectionnés par catégorie avec recherche et copie en un clic',
    },
    'md-mindmap': {
      name: 'Carte mentale Markdown',
      description: 'Transformer Markdown en carte mentale avec thèmes, zoom et export PNG/SVG',
    },
    'mermaid-editor': {
      name: 'Éditeur de diagrammes Mermaid',
      description: 'Rendre Mermaid en local avec thèmes, zoom et export PNG/SVG',
    },
    'css-gradient': {
      name: 'Générateur de dégradés CSS',
      description: 'Éditer dégradés linéaires / radiaux avec préréglages classés et copie CSS',
    },
    'image-to-paper': {
      name: 'Image vers PDF papier',
      description: 'Adapter des images à A3/A4/A5/Letter et exporter en PDF',
    },
    'md-to-image': {
      name: 'Markdown vers image',
      description:
        'Rendre Markdown en carte stylée et exporter PNG avec police, taille, largeur et couleurs',
    },
    'chart-generator': {
      name: 'Générateur de graphiques',
      description:
        'Créer barres/lignes/aires/camemberts/anneaux/nuages à partir de CSV avec légendes et palettes',
    },
    'css3-generator': {
      name: 'Générateur de code CSS3',
      description: 'Générer border-radius, ombres, transform, filter et plus',
    },
    'xslt-transform': {
      name: 'Transformation XSLT',
      description: 'Transformer XML en HTML avec XSLT dans le navigateur',
    },
    'rich-text-editor': {
      name: 'Traitement de texte',
      description: "Rédaction locale avec import/export Word (.docx) et deux modes d'export PDF",
    },
    'slide-editor': {
      name: 'Éditeur de diapositives',
      description:
        'Édition locale sur canvas avec import/export PowerPoint (.pptx) et mode diaporama',
    },
    'spreadsheet-editor': {
      name: 'Éditeur de tableur',
      description:
        'Édition locale avec import/export Excel (.xlsx), formules et plusieurs feuilles',
    },
    'pdf-merge': {
      name: 'Fusionner des PDF',
      description: 'Fusionner plusieurs PDF en un seul fichier',
    },
    'pdf-split': {
      name: 'Diviser un PDF',
      description: 'Diviser un PDF en un fichier par page',
    },
    'pdf-delete-pages': {
      name: 'Supprimer des pages PDF',
      description: 'Retirer des pages sélectionnées d’un PDF',
    },
    'pdf-extract-pages': {
      name: 'Extraire des pages PDF',
      description: 'Extraire des pages sélectionnées dans un nouveau PDF',
    },
    'pdf-reorder': {
      name: 'Réordonner les pages PDF',
      description: 'Changer l’ordre des pages d’un PDF',
    },
    'pdf-rotate': {
      name: 'Faire pivoter des pages PDF',
      description: 'Faire pivoter des pages sélectionnées ou toutes',
    },
    'pdf-to-image': {
      name: 'PDF vers image',
      description: 'Rendre les pages PDF en JPG/PNG',
    },
    'images-to-pdf': {
      name: 'Images vers PDF',
      description: 'Combiner des images en un PDF',
    },
    'pdf-viewer': {
      name: 'Visionneuse PDF',
      description: 'Ouvrir et lire un PDF en local',
    },
    'pdf-page-numbers': {
      name: 'Numéros de page PDF',
      description: 'Ajouter des numéros de page à un PDF',
    },
    'pdf-header-footer': {
      name: 'En-tête et pied de page PDF',
      description: 'Ajouter du texte d’en-tête et de pied de page',
    },
    'pdf-insert-image': {
      name: 'Insérer une image dans un PDF',
      description: 'Placer une image sur des pages PDF',
    },
    'pdf-add-text': {
      name: 'Ajouter du texte à un PDF',
      description: 'Ajouter du texte sur des pages PDF',
    },
    'pdf-sign': {
      name: 'Signer un PDF',
      description: 'Dessiner ou téléverser une image de signature (visuel, pas de certificat)',
    },
    'pdf-metadata': {
      name: 'Métadonnées PDF',
      description: 'Afficher et modifier les métadonnées PDF',
    },
    'pdf-encrypt': {
      name: 'Chiffrer un PDF',
      description: 'Définir mot de passe et drapeaux d’autorisation',
    },
    'pdf-crop': {
      name: 'Recadrer un PDF',
      description: 'Recadrer les marges de page via cropBox',
    },
    'pdf-grayscale': {
      name: 'PDF niveaux de gris',
      description: 'Convertir un PDF en niveaux de gris visuels',
    },
    'pdf-annotate': {
      name: 'Annoter un PDF',
      description: 'Dessiner surlignages, traits libres, formes et texte sur les pages PDF',
    },
  },
} satisfies ShellResources;

export default fr;
