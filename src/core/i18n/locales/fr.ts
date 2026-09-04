import type { TranslationResources } from '../types';

/** French translation resources */
const fr = {
  "app": {
    "docTitle": "SynTools · Boîte à outils en ligne pour développeurs"
  },
  "header": {
    "openMenu": "Ouvrir le menu",
    "searchPlaceholder": "Rechercher des outils…",
    "searchAria": "Rechercher des outils",
    "themeAria": "Changer de thème",
    "langAria": "Changer de langue",
    "sourceAria": "Code source"
  },
  "sidebar": {
    "nav": "Navigation des outils",
    "closeMenu": "Fermer le menu",
    "filter": "Filtrer les outils",
    "filterPlaceholder": "Filtrer…",
    "filterEmpty": "Aucun outil correspondant"
  },
  "home": {
    "title": "Boîte à outils en ligne pour développeurs",
    "tagline": "Traitement local d’abord ; les données restent dans votre navigateur (CSP, zéro envoi) · Appuyez sur <1>⌘K</1> ou <3>/</3> pour rechercher",
    "favorites": "Favoris",
    "recent": "Récemment utilisés",
    "favoriteAria": "Ajouter aux favoris",
    "unfavoriteAria": "Retirer des favoris"
  },
  "search": {
    "aria": "Rechercher des outils",
    "placeholder": "Rechercher des outils (nom / mots-clés)…",
    "empty": "Aucun outil correspondant trouvé"
  },
  "categories": {
    "encoding": "Encodage",
    "text": "Texte",
    "formatting": "Formatage",
    "crypto": "Crypto et hash",
    "datetime": "Date et heure",
    "generator": "Générateurs",
    "network": "Réseau",
    "image": "Images",
    "pdf": "PDF",
    "other": "Autres"
  },
  "common": {
    "copy": "Copier",
    "copied": "Copié",
    "clear": "Effacer",
    "swap": "Échanger",
    "download": "Télécharger",
    "share": "Partager",
    "shareTooLong": "Contenu trop long (> 2 Ko), impossible de créer un lien de partage",
    "retry": "Réessayer",
    "loading": "Chargement",
    "operation": "Action",
    "encode": "Encoder",
    "decode": "Décoder",
    "result": "Résultat",
    "rawText": "Texte brut",
    "input": "Entrée",
    "output": "Sortie",
    "text": "Texte",
    "file": "Fichier",
    "remove": "Supprimer",
    "bytes": "{{size}} octets"
  },
  "io": {
    "stats": "{{chars}} caractères / {{bytes}} octets",
    "warnLarge": "Entrée volumineuse (> 500 Ko), le calcul en temps réel peut ralentir",
    "overflow": "L’entrée dépasse la limite de 5 Mo ; utilisez le mode fichier pour les grands contenus"
  },
  "file": {
    "hint": "Glissez-déposez un fichier ici, ou cliquez pour choisir",
    "max": "Max. {{size}}",
    "over": "Le fichier dépasse la limite de {{max}} (actuel {{size}})",
    "uploadAria": "Téléverser un fichier",
    "previewAlt": "Aperçu de {{name}}",
    "pages": "{{n}} pages",
    "encrypted": "Chiffré"
  },
  "tool": {
    "errorTitle": "Erreur d’exécution de l’outil",
    "localBadge": "Local uniquement",
    "serverBadge": "Serveur requis",
    "related": "Outils associés",
    "nextSteps": "Étapes suivantes",
    "openIn": "Ouvrir dans {{name}}",
    "progress": "Progression {{current}} / {{total}}"
  },
  "notFound": {
    "message": "Page ou outil introuvable",
    "back": "Retour à l’accueil"
  },
  "pdf": {
    "password": "Mot de passe PDF",
    "passwordPlaceholder": "Saisissez le mot de passe d’ouverture",
    "passwordHint": "Ce PDF est chiffré. Entrez le mot de passe pour continuer.",
    "unlock": "Déverrouiller",
    "errors": {
      "NEED_PASSWORD": "Ce PDF est chiffré. Veuillez saisir le mot de passe.",
      "WRONG_PASSWORD": "Mot de passe incorrect. Veuillez réessayer."
    }
  },
  "toolsMeta": {
    "base64": {
      "name": "Encodage / décodage Base64",
      "description": "Conversion texte ↔ Base64 Unicode-safe ; modes URL Safe et fichier pris en charge"
    },
    "url-codec": {
      "name": "Encodage / décodage URL",
      "description": "Modes encodeURIComponent / encodeURI avec détection des pourcentages mal formés"
    },
    "regex-tester": {
      "name": "Outil d’expressions régulières",
      "description": "Surlignage des correspondances, remplacement, groupes de capture, préréglages et aide-mémoire"
    },
    "text-diff": {
      "name": "Différence de texte",
      "description": "Éditeurs côte à côte avec surlignage de lignes, numéros de ligne et ignore des espaces"
    },
    "json-format": {
      "name": "Formateur JSON",
      "description": "Formater / minifier / valider avec indentation 2/4 espaces et position d’erreur ligne/colonne"
    },
    "json-convert": {
      "name": "Convertisseur JSON",
      "description": "Analyser du JSON et le convertir en YAML / XML / CSV"
    },
    "timestamp": {
      "name": "Convertisseur d’horodatage",
      "description": "Unix ⇄ heure lisible avec détection auto secondes/ms et horloge en direct"
    },
    "uuid": {
      "name": "Générateur UUID",
      "description": "UUID v4 aléatoires / v7 ordonnés dans le temps, sortie par lot et options de format"
    },
    "hash": {
      "name": "Calculateur de hash",
      "description": "MD5 / SHA-1 / SHA-256 / SHA-512 pour texte et fichiers (streaming), sortie hex / base64"
    },
    "jwt-parser": {
      "name": "Analyseur JWT",
      "description": "Analyser header / payload / signature et lire exp et autres claims temporels (lecture seule, sans vérification)"
    },
    "aes-crypto": {
      "name": "Chiffrement / déchiffrement AES",
      "description": "AES-GCM avec phrase secrète PBKDF2 ou clé brute ; sortie base64(salt|iv|ciphertext)"
    },
    "hmac": {
      "name": "HMAC",
      "description": "HMAC-SHA256 / SHA512 avec sortie hex / base64"
    },
    "totp": {
      "name": "TOTP",
      "description": "TOTP RFC 6238 : générer / vérifier, 6/8 chiffres, secondes restantes"
    },
    "x509-decode": {
      "name": "Décodeur de certificat X.509",
      "description": "Analyser PEM : empreintes SHA-256/SHA-1, type, longueur DER, CN"
    },
    "cidr-calc": {
      "name": "Calculateur CIDR",
      "description": "CIDR IPv4 : réseau / diffusion / plage d’hôtes / masque / nombre d’hôtes"
    },
    "text-lines": {
      "name": "Outils de lignes de texte",
      "description": "Trier / dédupliquer / inverser / numéroter / supprimer les lignes vides"
    },
    "hex-codec": {
      "name": "Encodage / décodage Hex",
      "description": "Hex ↔ texte UTF-8 avec espaces optionnels"
    },
    "url-query": {
      "name": "Analyseur de requête URL",
      "description": "Analyser les parties d’URL et les paramètres ; reconstruire après édition"
    },
    "json-path": {
      "name": "Requête JSONPath",
      "description": "Requêtes de chemin simples du type a.b[0].c"
    },
    "gzip-tool": {
      "name": "Compression Gzip",
      "description": "Compresser du texte en Gzip vers base64 / décompresser vers texte"
    },
    "exif-strip": {
      "name": "Supprimer EXIF",
      "description": "Lire l’EXIF JPEG de base et supprimer APP1 ; télécharger le fichier nettoyé"
    },
    "fake-data": {
      "name": "Générateur de fausses données",
      "description": "Générer noms / e-mails / UUID / lorem en zh/en, 1–50 éléments"
    },
    "password-gen": {
      "name": "Générateur de mots de passe",
      "description": "Mots de passe aléatoires forts avec longueur / jeu de caractères, entropie et force"
    },
    "entity-codec": {
      "name": "Encodage / décodage HTML",
      "description": "Encoder/décoder les caractères spéciaux HTML : nommés / décimal / hex / échappements \\u"
    },
    "cron-parser": {
      "name": "Analyseur d’expression Cron",
      "description": "Valider les expressions cron, expliquer les champs et prévisualiser les prochaines exécutions"
    },
    "convert-data": {
      "name": "Convertisseur de formats de config",
      "description": "Convertir YAML ⇄ JSON ⇄ TOML via une valeur JS sans perte"
    },
    "sql-format": {
      "name": "Formateur SQL",
      "description": "Embellir le SQL multi-dialectes avec indentation et casse des mots-clés configurables"
    },
    "html-format": {
      "name": "Minification / embelliissement HTML",
      "description": "Minifier et embellir le HTML avec indentation 2/4 espaces"
    },
    "js-format": {
      "name": "Minification / embelliissement JS",
      "description": "Minifier et embellir le JavaScript avec indentation 2/4 espaces"
    },
    "css-format": {
      "name": "Minification / embelliissement CSS",
      "description": "Minifier et embellir le CSS avec indentation 2/4 espaces"
    },
    "xml-format": {
      "name": "Minification / embelliissement XML",
      "description": "Embellir et minifier le XML avec indentation 2/4 espaces ; CDATA conservé"
    },
    "xml-json": {
      "name": "XML vers JSON",
      "description": "Analyser le XML en JSON en conservant les attributs avec le préfixe @_"
    },
    "qrcode": {
      "name": "Code QR",
      "description": "Générer et décoder des codes QR avec ECC, taille, couleurs et marge"
    },
    "color-converter": {
      "name": "Convertisseur de couleurs",
      "description": "Convertir et prévisualiser les formats HEX / RGB / HSL"
    },
    "radix-converter": {
      "name": "Convertisseur de bases",
      "description": "Convertir bases 2/8/10/16 et visualiser les opérations bit à bit sur entiers signés 64 bits"
    },
    "markdown-preview": {
      "name": "Aperçu Markdown",
      "description": "Rendu GFM en direct avec assainissement DOMPurify pour un aperçu sûr"
    },
    "image-compress": {
      "name": "Compression d’image",
      "description": "Compression et conversion de format côté client (PNG / JPEG / WebP) avec redimensionnement et qualité"
    },
    "unicode-codec": {
      "name": "Codec Unicode",
      "description": "Convertir texte ↔ \\uXXXX, points de code, entités HTML et octets UTF-8"
    },
    "html-color-picker": {
      "name": "Sélecteur de couleur HTML",
      "description": "Choisir des couleurs visuellement et exporter HEX / RGB / HSL plus snippets HTML/CSS"
    },
    "web-color-table": {
      "name": "Table des couleurs Web",
      "description": "Couleurs nommées CSS avec filtres par groupe et copie nom / HEX / RGB"
    },
    "pinyin": {
      "name": "Chinois vers pinyin",
      "description": "Convertir le chinois en pinyin avec tons, séparateur et casse optionnels"
    },
    "length-converter": {
      "name": "Convertisseur de longueurs",
      "description": "Convertir unités métriques et impériales (mm, cm, m, km, in, ft, etc.)"
    },
    "zh-convert": {
      "name": "Convertisseur chinois traditionnel",
      "description": "Convertir entre chinois simplifié et traditionnel"
    },
    "weight-converter": {
      "name": "Convertisseur de poids",
      "description": "Convertir unités métriques et impériales (mg, g, kg, t, oz, lb, st)"
    },
    "text-counter": {
      "name": "Compteur de texte",
      "description": "Compter caractères, mots, lignes, paragraphes, caractères CJK et octets UTF-8"
    },
    "calendar": {
      "name": "Calendrier",
      "description": "Vue mensuelle avec calendrier lunaire/almanach pour le chinois et jours fériés locaux pour l’anglais"
    },
    "css-button": {
      "name": "Générateur de boutons CSS",
      "description": "Ajuster les styles visuellement et générer CSS / HTML de bouton"
    },
    "random-number": {
      "name": "Générateur de nombres aléatoires",
      "description": "Générer des entiers ou décimales aléatoires dans une plage, avec unicité optionnelle"
    },
    "random-string": {
      "name": "Générateur de chaînes aléatoires",
      "description": "Générer des chaînes par longueur et jeu de caractères (alnum / hex / personnalisé)"
    },
    "doodle-board": {
      "name": "Tableau de dessin",
      "description": "Bloc de dessin navigateur avec pinceau, gomme et export PNG"
    },
    "calculator": {
      "name": "Calculatrice",
      "description": "Calculateur d’expressions sûr : arithmétique, puissance, modulo et fonctions courantes"
    },
    "code-image": {
      "name": "Code vers image",
      "description": "Rendre le code en carte avec coloration syntaxique et exporter en PNG"
    },
    "image-color-picker": {
      "name": "Pipette de couleur d’image",
      "description": "Téléverser une image et cliquer un pixel pour échantillonner HEX / RGB"
    },
    "ascii-table": {
      "name": "Table ASCII",
      "description": "Référence ASCII 0–127 avec recherche par décimal, hex ou caractère"
    },
    "image-watermark": {
      "name": "Filigrane d’image",
      "description": "Ajouter un filigrane texte avec position, opacité, rotation et mosaïque"
    },
    "case-convert": {
      "name": "Convertisseur de casse",
      "description": "Convertir casse et styles de nommage (camel / snake / kebab, etc.)"
    },
    "bmi-calculator": {
      "name": "Calculateur d’IMC",
      "description": "Calculer l’IMC à partir de la taille et du poids avec catégories OMS adultes"
    },
    "placeholder-image": {
      "name": "Image placeholder",
      "description": "Générer un PNG placeholder par taille, couleurs et texte optionnel"
    },
    "image-merge": {
      "name": "Fusion d’images",
      "description": "Assembler des images horizontalement, verticalement ou en grille en un PNG"
    },
    "cron-generator": {
      "name": "Générateur Crontab",
      "description": "Construire une expression Cron standard à 5 champs depuis minute/heure/jour/mois/jour de semaine"
    },
    "ua-parser": {
      "name": "Analyseur User-Agent",
      "description": "Analyser un User-Agent navigateur en navigateur, moteur, OS et appareil"
    },
    "latex-editor": {
      "name": "Éditeur mathématique LaTeX",
      "description": "Symboles rapides et formules classiques, aperçu KaTeX, export PNG/JPG/SVG"
    },
    "countdown": {
      "name": "Minuteur compte à rebours",
      "description": "Régler heures, minutes et secondes ; pause, reprise et alerte de fin"
    },
    "stopwatch": {
      "name": "Chronomètre",
      "description": "Chronomètre en ligne avec démarrage, pause, tour et réinitialisation"
    },
    "svg-to-png": {
      "name": "SVG vers PNG",
      "description": "Convertir balisage ou fichiers SVG en PNG avec échelle et transparence"
    },
    "image-frame": {
      "name": "Bordure / rayon / ombre d’image",
      "description": "Ajouter bordure, coins arrondis et ombre, puis exporter en PNG"
    },
    "image-adjust": {
      "name": "Réglage des couleurs d’image",
      "description": "Ajuster luminosité, contraste, saturation et teinte, puis exporter en PNG"
    },
    "gif-frames": {
      "name": "Extracteur de frames GIF",
      "description": "Découper un GIF en frames PNG ; télécharger une ou toutes"
    },
    "image-crop": {
      "name": "Recadrage d’image",
      "description": "Recadrer librement ou avec ratios fixes vers PNG"
    },
    "mbti-test": {
      "name": "Test de personnalité MBTI",
      "description": "Quiz MBTI court de 24 questions (divertissement uniquement)"
    },
    "text-card": {
      "name": "Texte vers carte",
      "description": "Mettre en page titre et corps en carte stylée et exporter en PNG"
    },
    "image-card": {
      "name": "Image vers carte",
      "description": "Carte photo + titre/sous-titre avec arrière-plans ou dégradés, export PNG"
    },
    "code-highlight": {
      "name": "Colorateur de code",
      "description": "Coloration syntaxique en direct avec numéros de ligne et copie de snippet HTML"
    },
    "image-base64": {
      "name": "Image ↔ Base64",
      "description": "Convertir images ↔ Base64 / Data URL, entièrement en local"
    },
    "image-ico": {
      "name": "Convertisseur ICO",
      "description": "Convertir des images en ICO multi-tailles (favicon), ou extraire PNG depuis ICO"
    },
    "hsv-cmyk": {
      "name": "Convertisseur HSV / CMYK",
      "description": "Convertir et prévisualiser les espaces RGB, HSV, CMYK et HEX"
    },
    "ai-prompts": {
      "name": "Bibliothèque de prompts IA",
      "description": "Prompts sélectionnés par catégorie avec recherche et copie en un clic"
    },
    "md-mindmap": {
      "name": "Carte mentale Markdown",
      "description": "Transformer Markdown en carte mentale avec thèmes, zoom et export PNG/SVG"
    },
    "mermaid-editor": {
      "name": "Éditeur de diagrammes Mermaid",
      "description": "Rendre Mermaid en local avec thèmes, zoom et export PNG/SVG"
    },
    "css-gradient": {
      "name": "Générateur de dégradés CSS",
      "description": "Éditer dégradés linéaires / radiaux avec préréglages classés et copie CSS"
    },
    "image-to-paper": {
      "name": "Image vers PDF papier",
      "description": "Adapter des images à A3/A4/A5/Letter et exporter en PDF"
    },
    "md-to-image": {
      "name": "Markdown vers image",
      "description": "Rendre Markdown en carte stylée et exporter PNG avec police, taille, largeur et couleurs"
    },
    "chart-generator": {
      "name": "Générateur de graphiques",
      "description": "Créer barres/lignes/aires/camemberts/anneaux/nuages à partir de CSV avec légendes et palettes"
    },
    "css3-generator": {
      "name": "Générateur de code CSS3",
      "description": "Générer border-radius, ombres, transform, filter et plus"
    },
    "xslt-transform": {
      "name": "Transformation XSLT",
      "description": "Transformer XML en HTML avec XSLT dans le navigateur"
    },
    "pdf-merge": {
      "name": "Fusionner des PDF",
      "description": "Fusionner plusieurs PDF en un seul fichier"
    },
    "pdf-split": {
      "name": "Diviser un PDF",
      "description": "Diviser un PDF en un fichier par page"
    },
    "pdf-delete-pages": {
      "name": "Supprimer des pages PDF",
      "description": "Retirer des pages sélectionnées d’un PDF"
    },
    "pdf-extract-pages": {
      "name": "Extraire des pages PDF",
      "description": "Extraire des pages sélectionnées dans un nouveau PDF"
    },
    "pdf-reorder": {
      "name": "Réordonner les pages PDF",
      "description": "Changer l’ordre des pages d’un PDF"
    },
    "pdf-rotate": {
      "name": "Faire pivoter des pages PDF",
      "description": "Faire pivoter des pages sélectionnées ou toutes"
    },
    "pdf-to-image": {
      "name": "PDF vers image",
      "description": "Rendre les pages PDF en JPG/PNG"
    },
    "images-to-pdf": {
      "name": "Images vers PDF",
      "description": "Combiner des images en un PDF"
    },
    "pdf-viewer": {
      "name": "Visionneuse PDF",
      "description": "Ouvrir et lire un PDF en local"
    },
    "pdf-page-numbers": {
      "name": "Numéros de page PDF",
      "description": "Ajouter des numéros de page à un PDF"
    },
    "pdf-header-footer": {
      "name": "En-tête et pied de page PDF",
      "description": "Ajouter du texte d’en-tête et de pied de page"
    },
    "pdf-insert-image": {
      "name": "Insérer une image dans un PDF",
      "description": "Placer une image sur des pages PDF"
    },
    "pdf-add-text": {
      "name": "Ajouter du texte à un PDF",
      "description": "Ajouter du texte sur des pages PDF"
    },
    "pdf-sign": {
      "name": "Signer un PDF",
      "description": "Dessiner ou téléverser une image de signature (visuel, pas de certificat)"
    },
    "pdf-metadata": {
      "name": "Métadonnées PDF",
      "description": "Afficher et modifier les métadonnées PDF"
    },
    "pdf-encrypt": {
      "name": "Chiffrer un PDF",
      "description": "Définir mot de passe et drapeaux d’autorisation"
    },
    "pdf-crop": {
      "name": "Recadrer un PDF",
      "description": "Recadrer les marges de page via cropBox"
    },
    "pdf-grayscale": {
      "name": "PDF niveaux de gris",
      "description": "Convertir un PDF en niveaux de gris visuels"
    },
    "pdf-annotate": {
      "name": "Annoter un PDF",
      "description": "Dessiner surlignages, traits libres, formes et texte sur les pages PDF"
    }
  },
  "tools": {
    "base64": {
      "direction": {
        "encode": "Encoder (texte → Base64)",
        "decode": "Décoder (Base64 → texte)"
      },
      "urlSafe": "URL Safe (- _ sans padding)",
      "labels": {
        "rawText": "Texte brut",
        "base64Input": "Entrée Base64",
        "base64Result": "Résultat Base64",
        "decodeResult": "Résultat décodé"
      },
      "placeholders": {
        "encode": "Saisissez text to encode…",
        "decode": "Collez a Base64 string…"
      },
      "fileNote": "Affichage d’un résultat Base64 de fichier ; saisir du texte l’effacera.",
      "fileMode": "Mode fichier : fichier → Base64 (chunks ArrayBuffer)",
      "err": {
        "INVALID_PADDING": "Padding « = » invalide à la position {{position}}",
        "INVALID_CHAR": "Caractère invalide « {{char}} » à la position {{position}}",
        "INVALID_LENGTH": "Longueur invalide : la longueur Base64 modulo 4 ne peut pas être 1",
        "DECODE_FAILED": "Échec du décodage : entrée Base64 invalide"
      }
    },
    "url": {
      "modes": {
        "component": "component (valeur de paramètre, encode les caractères réservés)",
        "full": "URL complète (conserve : / ? & etc.)"
      },
      "mode": "Mode",
      "labels": {
        "rawText": "Texte brut",
        "encodedText": "Texte encodé"
      },
      "placeholders": {
        "encode": "Saisissez content to encode…",
        "decode": "Collez percent-encoded content…"
      },
      "err": {
        "ENCODE_FAILED": "Échec de l’encodage : l’entrée contient des surrogates non appariés",
        "DECODE_FAILED": "Échec du décodage : encodage pourcentage mal formé"
      }
    },
    "regex": {
      "presets": "Préréglages",
      "presetPlaceholder": "Choisir pour remplir…",
      "expression": "Motif",
      "expressionPlaceholder": "e.g. \\d+",
      "flags": "Drapeaux",
      "testText": "Texte de test",
      "testTextPlaceholder": "Collez text to match…",
      "matchCount": "{{count}} correspondance(s)",
      "truncated": " (tronqué, affichage des 1000 premiers)",
      "position": "Index",
      "matchContent": "Correspondance",
      "captureGroups": "Groupes",
      "emptyMatch": "(correspondance vide)",
      "tableLimit": "Affichage des {{count}} premières lignes uniquement",
      "mode": "Mode",
      "modes": {
        "match": "Correspondance",
        "replace": "Remplacer"
      },
      "replacement": "Remplacer par",
      "replacementPlaceholder": "Prend en charge $1, $&, …",
      "replaceResult": "Résultat du remplacement",
      "cheatSheet": "Aide-mémoire (cliquer pour insérer)",
      "cheat": {
        "dot": "N’importe quel caractère",
        "digit": "Chiffre",
        "word": "Car. de mot",
        "space": "Espace blanc",
        "start": "Début de ligne",
        "end": "Fin de ligne",
        "star": "0 ou plus",
        "plus": "1 ou plus",
        "question": "0 ou 1",
        "or": "Alternative",
        "group": "Groupe capturant",
        "class": "Classe de caractères",
        "range": "Plage",
        "not": "Classe négative"
      },
      "presetsList": {
        "email": "E-mail",
        "phoneCn": "Téléphone (Chine continentale)",
        "idCard": "Carte d’identité (18 chiffres)",
        "url": "URL",
        "ipv4": "Adresse IPv4",
        "date": "Date (yyyy-mm-dd)"
      },
      "err": {
        "EMPTY": "L’expression régulière ne peut pas être vide",
        "COMPILE": "Échec de compilation : {{message}}",
        "TEXT_TOO_LONG": "Le texte dépasse la limite de {{limit}}K caractères ; correspondance arrêtée (protection ReDoS / longue durée)"
      }
    },
    "textDiff": {
      "oldText": "Original",
      "newText": "Révisé",
      "swapSides": "Échanger les côtés",
      "stats": "+{{added}} ajoutés / −{{removed}} supprimés / {{same}} inchangés",
      "identical": "Les deux textes sont identiques",
      "renderLimit": "Trop de lignes de diff ; affichage des {{count}} premières uniquement",
      "ignoreWhitespace": "Ignorer espaces finaux / répétés",
      "err": {
        "TOO_LARGE": "Le texte combiné dépasse la limite de {{limit}}K caractères ; diff arrêté (protection longue durée)"
      }
    },
    "json": {
      "actions": {
        "format": "Formater",
        "compress": "Minifier",
        "validate": "Valider seulement"
      },
      "indent": "Indentation",
      "indent2": "2 espaces",
      "indent4": "4 espaces",
      "inputLabel": "Entrée JSON",
      "validateResult": "Résultat de validation",
      "inputPlaceholder": "Collez JSON, e.g. {\"a\": 1}…",
      "valid": "✓ JSON valide",
      "err": {
        "EMPTY": "Échec d’analyse JSON : entrée vide",
        "UNKNOWN": "Échec d’analyse JSON : erreur inconnue",
        "INVALID_LITERAL": "Échec d’analyse JSON : littéral « {{literal}} » attendu (ligne {{line}}, colonne {{column}})",
        "NEWLINE_IN_STRING": "Échec d’analyse JSON : une chaîne ne peut pas s’étendre sur plusieurs lignes (ligne {{line}}, colonne {{column}})",
        "UNEXPECTED_STRING_END": "Échec d’analyse JSON : fin de chaîne inattendue (ligne {{line}}, colonne {{column}})",
        "INVALID_UNICODE_ESCAPE": "Échec d’analyse JSON : échappement \\u invalide, 4 chiffres hex requis (ligne {{line}}, colonne {{column}})",
        "INVALID_ESCAPE": "Échec d’analyse JSON : échappement invalide « \\{{char}} » (ligne {{line}}, colonne {{column}})",
        "INVALID_NUMBER": "Échec d’analyse JSON : nombre invalide (ligne {{line}}, colonne {{column}})",
        "DECIMAL_NO_DIGITS": "Échec d’analyse JSON : chiffres requis après le point décimal (ligne {{line}}, colonne {{column}})",
        "EXPONENT_NO_DIGITS": "Échec d’analyse JSON : chiffres requis dans l’exposant (ligne {{line}}, colonne {{column}})",
        "UNEXPECTED_END": "Échec d’analyse JSON : fin inattendue, valeur manquante (ligne {{line}}, colonne {{column}})",
        "INVALID_CHAR": "Échec d’analyse JSON : caractère invalide « {{char}} » (ligne {{line}}, colonne {{column}})",
        "TRAILING_COMMA": "Échec d’analyse JSON : virgule finale non autorisée (ligne {{line}}, colonne {{column}})",
        "KEY_MUST_BE_STRING": "Échec d’analyse JSON : la clé d’objet doit être une chaîne (ligne {{line}}, colonne {{column}})",
        "MISSING_COLON": "Échec d’analyse JSON : « : » manquant après la clé d’objet (ligne {{line}}, colonne {{column}})",
        "MISSING_VALUE": "Échec d’analyse JSON : valeur manquante (ligne {{line}}, colonne {{column}})",
        "UNCLOSED_OBJECT": "Échec d’analyse JSON : objet non fermé, « } » manquant (ligne {{line}}, colonne {{column}})",
        "MISSING_COMMA_OBJECT": "Échec d’analyse JSON : « , » manquant entre membres d’objet (ligne {{line}}, colonne {{column}})",
        "UNCLOSED_ARRAY": "Échec d’analyse JSON : tableau non fermé, « ] » manquant (ligne {{line}}, colonne {{column}})",
        "MISSING_COMMA_ARRAY": "Échec d’analyse JSON : « , » manquant entre éléments de tableau (ligne {{line}}, colonne {{column}})",
        "EXTRA_CONTENT": "Échec d’analyse JSON : contenu supplémentaire après la valeur (ligne {{line}}, colonne {{column}})",
        "UNCLOSED_STRING": "Échec d’analyse JSON : chaîne non fermée (ligne {{line}}, colonne {{column}})"
      }
    },
    "timestamp": {
      "currentTime": "Heure actuelle",
      "pauseTick": "Mettre l’horloge en pause",
      "resumeTick": "Reprendre l’horloge",
      "second": "Secondes",
      "millisecond": "Millisecondes",
      "localPrefix": "Local : {{local}} · {{utc}}",
      "tsToReadable": "Horodatage → heure lisible (détection auto secondes / ms)",
      "fillCurrentSec": "Remplir actuel (secondes)",
      "tsInput": "Entrée d’horodatage",
      "tsPlaceholder": "e.g. 1725000000 or 1725000000000",
      "localTime": "Heure locale",
      "relative": "Relatif (détecté comme {{unit}})",
      "unitSeconds": "secondes",
      "unitMilliseconds": "millisecondes",
      "dateToTs": "Heure lisible → horodatage (séparé par espaces = fuseau local)",
      "dateInput": "Entrée date/heure",
      "datePlaceholder": "e.g. 2026-09-01 12:00:00 or 2026-09-01T04:00:00Z",
      "relativeAgo": "il y a {{count}} {{unit}}",
      "relativeLater": "dans {{count}} {{unit}}",
      "units": {
        "second": "secondes",
        "minute": "minutes",
        "hour": "heures",
        "day": "jours",
        "year": "années"
      },
      "err": {
        "NOT_NUMERIC": "L’horodatage doit être numérique (négatif autorisé)",
        "OUT_OF_RANGE": "Horodatage hors plage numérique",
        "TS_TOO_LARGE": "Horodatage hors de la plage représentable (±275760 ans)",
        "DATE_EMPTY": "Veuillez saisir a date/time",
        "DATE_INVALID": "Impossible d’analyser la date/heure (ex. 2026-09-01 12:00:00 ou ISO 8601)"
      }
    },
    "uuid": {
      "version": "Version",
      "versions": {
        "v4": "v4 (aléatoire)",
        "v7": "v7 (ordonné dans le temps)"
      },
      "count": "Nombre",
      "uppercase": "Majuscules",
      "hyphens": "Tirets",
      "braces": "Accolades",
      "generate": "Générer",
      "output": "Généré (un par ligne)",
      "err": {
        "INVALID_COUNT": "Le nombre doit être un entier ≥ 1",
        "TOO_MANY": "Maximum {{max}} UUID par lot"
      }
    },
    "hash": {
      "algorithm": "Algorithme",
      "encoding": "Sortie",
      "encodings": {
        "hex": "hex (hexadécimal)",
        "base64": "base64"
      },
      "source": "Source",
      "textInput": "Entrée texte",
      "textPlaceholder": "Saisissez text to hash…",
      "result": "Résultat {{algorithm}}",
      "computing": "Calcul…",
      "fileHint": "Glissez-déposez un fichier ici, ou cliquez pour choisir (MD5 en streaming ; gros fichiers sûrs en mémoire)",
      "limitHint": "Note : les algorithmes non-MD5 chargent tout le fichier en mémoire ; les très gros fichiers peuvent manquer de mémoire",
      "err": {
        "UNSUPPORTED": "Échec du hash : algorithme non pris en charge dans cet environnement",
        "FILE_HASH": "Échec du hash fichier : {{message}}",
        "FILE_READ": "Échec : read file contents"
      }
    },
    "jwt": {
      "mode": "Mode",
      "modes": {
        "parse": "Analyser",
        "sign": "Signer (HS256)"
      },
      "secretPlaceholder": "Secret HMAC…",
      "payloadJson": "Payload JSON",
      "payloadPlaceholder": "{ \"sub\": \"123\", \"name\": \"Alice\" }",
      "signedToken": "Jeton signé",
      "signNote": "Signe avec HS256 dans votre navigateur ; le secret ne quitte jamais l’appareil",
      "inputLabel": "Entrée JWT",
      "inputPlaceholder": "Collez un JWT (préfixe Bearer pris en charge), ex. eyJhbGci…",
      "header": "Header",
      "payload": "Payload",
      "signature": "Signature",
      "note": "Analyse seule, sans vérification de signature : la vérification nécessite une clé ; tout reste dans votre navigateur",
      "alg": "Algorithme",
      "expired": "Expiré",
      "notExpired": "Non expiré",
      "claims": {
        "exp": "Expiration exp",
        "nbf": "Pas avant nbf",
        "iat": "Émis à iat"
      },
      "err": {
        "EMPTY": "Veuillez coller a JWT",
        "INVALID_PARTS": "Format invalide : un JWT se compose de header.payload.signature",
        "INVALID_HEADER": "Échec de l’analyse du header : JSON encodé en base64url invalide",
        "INVALID_PAYLOAD": "Échec de l’analyse du payload : JSON encodé en base64url invalide",
        "SIGN_FAILED": "Échec de la signature"
      }
    },
    "aes-crypto": {
      "encrypt": "Chiffrer",
      "decrypt": "Déchiffrer",
      "keyMode": "Mode de clé",
      "passphrase": "Phrase secrète (PBKDF2)",
      "rawKey": "Clé brute (hex)",
      "passphrasePlaceholder": "Saisissez passphrase…",
      "keyHexPlaceholder": "32 ou 64 car. hex (AES-128/256)…",
      "ivPlaceholder": "IV optionnel (24 car. hex / 12 octets) ; aléatoire si vide",
      "plaintext": "Texte en clair",
      "ciphertext": "Texte chiffré (base64)",
      "inputPlaceholder": "Saisissez content…",
      "note": "Sortie chiffrée : base64(salt|iv|ciphertext+tag) ; la phrase utilise PBKDF2-SHA256",
      "err": {
        "EMPTY": "Veuillez saisir content",
        "INVALID_KEY": "Clé invalide : vérifiez la phrase secrète ou la longueur de clé hex",
        "DECRYPT_FAILED": "Échec du déchiffrement : mauvaise clé ou données corrompues",
        "INVALID_INPUT": "input: bad ciphertext or IV invalide"
      }
    },
    "hmac": {
      "algorithm": "Algorithme",
      "encoding": "Sortie",
      "secretPlaceholder": "Secret HMAC…",
      "message": "Message",
      "messagePlaceholder": "Message à authentifier…",
      "err": {
        "EMPTY": "Veuillez saisir a message",
        "INVALID_KEY": "Veuillez saisir a valid secret"
      }
    },
    "totp": {
      "digits": "Chiffres",
      "secret": "Secret Base32",
      "secretPlaceholder": "Collez Authenticator secret (Base32)…",
      "code": "Code actuel",
      "remaining": "Secondes restantes",
      "verify": "Vérifier le code (optionnel)",
      "verifyPlaceholder": "Saisissez 6/8-digit code…",
      "verifyOk": "Vérifié",
      "verifyFail": "Échec de la vérification",
      "err": {
        "EMPTY": "Veuillez saisir secret or code",
        "INVALID_SECRET": "Le secret n’est pas un Base32 valide"
      }
    },
    "cidr-calc": {
      "input": "CIDR",
      "placeholder": "e.g. 192.168.1.0/24",
      "fields": {
        "network": "Réseau",
        "broadcast": "Diffusion",
        "firstHost": "Premier hôte",
        "lastHost": "Dernier hôte",
        "netmask": "Masque réseau",
        "wildcard": "Joker",
        "prefix": "Préfixe",
        "hostCount": "Nombre d’hôtes",
        "totalAddresses": "Adresses totales"
      },
      "err": {
        "EMPTY": "Veuillez saisir a CIDR",
        "INVALID": "CIDR invalide (IPv4/préfixe, ex. 10.0.0.0/8)"
      }
    },
    "text-lines": {
      "placeholder": "Un élément par ligne…",
      "ops": {
        "sort-asc": "Tri croissant",
        "sort-desc": "Tri décroissant",
        "unique": "Unique",
        "reverse": "Inverser",
        "number": "Numéroter les lignes",
        "trim-empty": "Supprimer les lignes vides"
      },
      "err": {
        "EMPTY": "Veuillez saisir text"
      }
    },
    "hex-codec": {
      "spaced": "Octets séparés par des espaces",
      "placeholder": "Texte ou hex…",
      "err": {
        "EMPTY": "Veuillez saisir content",
        "INVALID_HEX": "hex (even length, 0-9a-f) invalide"
      }
    },
    "url-query": {
      "input": "URL",
      "placeholder": "https://example.com/path?a=1&b=2",
      "addParam": "Ajouter un paramètre",
      "key": "Clé",
      "value": "Valeur",
      "rebuilt": "URL reconstruite",
      "parts": {
        "protocol": "Protocole",
        "hostname": "Hôte",
        "port": "Port",
        "pathname": "Chemin",
        "hash": "Hash",
        "origin": "Origine"
      },
      "err": {
        "EMPTY": "Veuillez saisir a URL",
        "INVALID_URL": "URL invalide"
      }
    },
    "json-path": {
      "pathPlaceholder": "Chemin, ex. a.b[0].c ou $.a.b[0]",
      "json": "JSON",
      "jsonPlaceholder": "Collez JSON…",
      "err": {
        "EMPTY": "Veuillez saisir JSON and a path",
        "INVALID_JSON": "Échec de l’analyse JSON",
        "NOT_FOUND": "Chemin introuvable"
      }
    },
    "gzip-tool": {
      "compress": "Compresser (texte → base64)",
      "decompress": "Décompresser (base64 → texte)",
      "placeholder": "Texte ou gzip base64…",
      "err": {
        "EMPTY": "Veuillez saisir content",
        "INVALID": "Entrée invalide",
        "DECOMPRESS_FAILED": "Échec de décompression : données gzip invalides"
      }
    },
    "x509-decode": {
      "input": "Certificat PEM",
      "placeholder": "-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----",
      "fields": {
        "pemType": "Type",
        "derLength": "Longueur DER",
        "sha256": "SHA-256",
        "sha1": "SHA-1",
        "subject": "CN du sujet",
        "issuer": "CN de l’émetteur"
      },
      "err": {
        "EMPTY": "Veuillez coller PEM",
        "INVALID_PEM": "PEM invalide"
      }
    },
    "exif-strip": {
      "hint": "JPEG uniquement : supprimer APP1 (EXIF) et télécharger.",
      "drop": "Déposez une image JPEG",
      "hasExif": "Contient EXIF",
      "orientation": "Orientation",
      "make": "Marque d’appareil",
      "yes": "Oui",
      "no": "Non",
      "download": "Télécharger le fichier nettoyé",
      "err": {
        "EMPTY": "Veuillez choisir a file",
        "UNSUPPORTED": "JPEG uniquement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "fake-data": {
      "kind": "Type",
      "locale": "Locale",
      "count": "Nombre",
      "generate": "Générer",
      "kinds": {
        "name": "Nom",
        "email": "E-mail",
        "uuid": "UUID",
        "lorem": "Paragraphe"
      },
      "err": {
        "EMPTY": "Veuillez compléter options",
        "INVALID_COUNT": "Le nombre doit être un entier de 1 à 50"
      }
    },
    "password": {
      "length": "Longueur",
      "generate": "Générer",
      "lowercase": "Minuscules (a-z)",
      "uppercase": "Majuscules (A-Z)",
      "digits": "Chiffres (0-9)",
      "symbols": "Symboles (!@#$%…)",
      "excludeAmbiguous": "Exclure les caractères ambigus (0 O 1 l I etc.)",
      "ensureEach": "Inclure au moins un caractère de chaque jeu sélectionné",
      "output": "Résultat",
      "outputPlaceholder": "Cliquez sur « Générer » pour créer un mot de passe",
      "entropy": "Entropie ≈ {{bits}} bits",
      "strength": {
        "weak": "Faible",
        "medium": "Moyen",
        "strong": "Fort"
      },
      "err": {
        "NO_SETS": "Veuillez sélectionner au moins un jeu de caractères",
        "INVALID_LENGTH": "La longueur doit être entre 4 et 128"
      }
    },
    "entity": {
      "direction": "Direction",
      "encode": "Encoder",
      "decode": "Décoder",
      "mode": "Formater",
      "modes": {
        "named": "Nommées (&amp;)",
        "decimal": "Décimal (&#38;)",
        "hex": "Hex (&#x26;)",
        "unicode": "Échappement \\u (\\u4E2D)"
      },
      "scope": "Portée",
      "scopes": {
        "special": "Caractères spéciaux seulement (&, <, > etc.)",
        "nonascii": "Caractères spéciaux + non-ASCII"
      },
      "input": "Entrée",
      "output": "Sortie",
      "inputEncodePlaceholder": "Texte à encoder, ex. <b>Hello</b>…",
      "inputDecodePlaceholder": "Texte à décoder, ex. &lt;b&gt;&#20320;&#22909;…",
      "unknown": "Entités non reconnues (conservées telles quelles)"
    },
    "cron": {
      "expression": "Expression",
      "placeholder": "e.g. */5 8-18 * * 1-5 or @daily (5 fields, 6 with seconds)",
      "count": "Nombre",
      "normalized": "Normalisé",
      "fieldsTitle": "Détail des champs",
      "colField": "Champ",
      "colValue": "Valeur",
      "colMeaning": "Signification",
      "nextTitle": "Prochaines {{count}} exécutions",
      "fieldNames": {
        "second": "Seconde",
        "minute": "Minute",
        "hour": "Heure",
        "day": "Jour",
        "month": "Mois",
        "week": "Jour de semaine"
      },
      "err": {
        "EMPTY": "Veuillez saisir a cron expression",
        "INVALID": "Impossible d’analyser : vérifiez le nombre de champs (5 ou 6) et les plages (min 0-59 / heure 0-23 / jour 1-31 / mois 1-12 / jour_semaine 0-7)"
      },
      "desc": {
        "every": {
          "second": "chaque seconde",
          "minute": "chaque minute",
          "hour": "chaque heure",
          "day": "chaque jour",
          "month": "chaque mois",
          "week": "chaque jour de la semaine"
        },
        "step": "tous les {{n}} {{unit}}",
        "at": "{{noun}}{{values}}",
        "range": "{{noun}}{{a}}–{{b}}",
        "rangeStep": "{{noun}}{{a}}–{{b}}, every {{n}}",
        "units": {
          "second": "secondes",
          "minute": "minutes",
          "hour": "heures",
          "day": "jours",
          "month": "mois",
          "week": "jours"
        },
        "nouns": {
          "second": "seconde ",
          "minute": "minute ",
          "hour": "heure ",
          "day": "jour ",
          "month": "mois ",
          "week": "jour_semaine "
        },
        "sep": ", ",
        "days": [
          "Dimanche",
          "Lundi",
          "Mardi",
          "Mercredi",
          "Jeudi",
          "Vendredi",
          "Samedi"
        ],
        "months": [
          "Janv",
          "Févr",
          "Mars",
          "Avr",
          "Mai",
          "Juin",
          "Juil",
          "Août",
          "Sept",
          "Oct",
          "Nov",
          "Déc"
        ]
      }
    },
    "convert": {
      "from": "De",
      "to": "Vers",
      "formats": {
        "yaml": "YAML",
        "json": "JSON",
        "toml": "TOML"
      },
      "input": "Entrée",
      "output": "Sortie",
      "placeholder": "Collez content to convert…",
      "err": {
        "PARSE": "Échec de l’analyse de l’entrée : veuillez vérifier la syntaxe",
        "STRINGIFY": "Impossible de convertir vers le format cible (ex. TOML ne prend pas en charge les tableaux/scalaires de premier niveau)"
      }
    },
    "sql": {
      "dialect": "Dialecte",
      "indent": "Indentation",
      "keywordCase": "Casse des mots-clés",
      "cases": {
        "upper": "UPPERCASE",
        "lower": "lowercase",
        "preserve": "Conserver"
      },
      "languages": {
        "sql": "SQL générique",
        "mysql": "MySQL",
        "postgresql": "PostgreSQL",
        "sqlite": "SQLite",
        "mariadb": "MariaDB",
        "transactsql": "SQL Server",
        "plsql": "PL/SQL"
      },
      "input": "Entrée SQL",
      "output": "Sortie",
      "placeholder": "Collez du SQL, ex. select * from users where id = 1…",
      "err": {
        "INVALID": "Impossible d’analyser ce SQL : veuillez vérifier la syntaxe"
      }
    },
    "html": {
      "actions": {
        "format": "Embellir",
        "compress": "Minifier"
      },
      "indent": "Indentation",
      "indent2": "2 espaces",
      "indent4": "4 espaces",
      "input": "Entrée HTML",
      "placeholder": "Collez du HTML, ex. <div><span>Hello</span></div>…",
      "err": {
        "EMPTY": "Veuillez saisir HTML content",
        "INVALID": "Échec du traitement : veuillez vérifier que le HTML est valide"
      }
    },
    "js": {
      "actions": {
        "format": "Embellir",
        "compress": "Minifier"
      },
      "indent": "Indentation",
      "indent2": "2 espaces",
      "indent4": "4 espaces",
      "input": "Entrée JavaScript",
      "placeholder": "Collez du JS, ex. function hello(){return 1}…",
      "err": {
        "EMPTY": "Veuillez saisir JavaScript content",
        "INVALID": "Échec du traitement : veuillez vérifier la syntaxe"
      }
    },
    "css": {
      "actions": {
        "format": "Embellir",
        "compress": "Minifier"
      },
      "indent": "Indentation",
      "indent2": "2 espaces",
      "indent4": "4 espaces",
      "input": "Entrée CSS",
      "placeholder": "Collez CSS, e.g. .box{color:red}…",
      "err": {
        "EMPTY": "Veuillez saisir CSS content",
        "INVALID": "Échec du traitement : veuillez vérifier que le CSS est valide"
      }
    },
    "qr": {
      "input": "Contenu texte",
      "placeholder": "Saisissez un texte ou une URL, ex. https://example.com…",
      "level": "Correction d’erreurs",
      "size": "Taille",
      "margin": "Marge",
      "foreground": "Premier plan",
      "background": "Arrière-plan",
      "levels": {
        "L": "L (~7%)",
        "M": "M (~15%)",
        "Q": "Q (~25%)",
        "H": "H (~30%)"
      },
      "preview": "Aperçu du code QR",
      "decodeTitle": "Décoder le code QR",
      "decodeHint": "Déposez ou choisissez une image contenant un code QR (PNG / JPG, etc.)",
      "decodeOutput": "Résultat décodé",
      "err": {
        "EMPTY": "Saisissez the content to encode",
        "TOO_LONG": "Contenu trop long pour un code QR : raccourcissez-le ou baissez le niveau de correction d’erreurs",
        "NOT_FOUND": "Aucun code QR trouvé dans l’image",
        "DECODE": "Échec : decode the image",
        "LOAD": "Échec du chargement de l’image : assurez-vous que c’est un fichier image valide",
        "INVALID_COLOR": "La couleur doit être #RGB ou #RRGGBB",
        "INVALID_MARGIN": "La marge doit être un entier de 0 à 10 (modules)"
      }
    },
    "color": {
      "input": "Couleur",
      "placeholder": "e.g. #3b82f6, rgb(59,130,246), hsl(217,91%,60%)…",
      "preview": "Aperçu de la couleur",
      "supportHint": "Prend en charge HEX / RGB / HSL (y compris abrégés et pourcentages)",
      "err": {
        "EMPTY": "Veuillez saisir a color value",
        "INVALID": "Impossible d’analyser : utilisez le format HEX, RGB ou HSL"
      }
    },
    "radix": {
      "radix": "Base",
      "auto": "Détection auto",
      "input": "Entrée entière",
      "placeholder": "e.g. 255, 0xff, 0b11111111, 0377…",
      "bitPattern": "Motif de bits",
      "twosComplement": "complément à deux",
      "bitOps": "Opérations bit à bit",
      "operator": "Opérateur",
      "operandB": "Opérande B",
      "opHint": "L’opérande A réutilise l’entrée ci-dessus ; les résultats restent dans la plage des entiers signés 64 bits",
      "ops": {
        "and": "AND",
        "or": "OR",
        "xor": "XOR",
        "shl": "<< (shift left)",
        "shr": ">> (shift right)",
        "not": "NOT"
      },
      "err": {
        "EMPTY": "Veuillez saisir an integer",
        "INVALID": "Impossible d’analyser : vérifiez la base et le format du nombre",
        "RANGE": "La valeur est hors de la plage des entiers signés 64 bits (−2⁶³ ~ 2⁶³−1)"
      }
    },
    "markdown": {
      "gfm": "GFM (tableaux / barré / listes de tâches)",
      "breaks": "Sauts de ligne souples",
      "input": "Éditeur Markdown",
      "placeholder": "Saisissez Markdown, e.g. # Heading…",
      "preview": "Aperçu",
      "shortcuts": "Raccourcis : ⌘/Ctrl+B gras · ⌘/Ctrl+I italique · ⌘/Ctrl+K lien · ⌘/Ctrl+E code en ligne",
      "toolbar": {
        "aria": "Barre d’outils Markdown",
        "bold": "Gras (**)",
        "italic": "Italique (*)",
        "strike": "Barré (~~)",
        "h1": "Titre 1 (#)",
        "h2": "Titre 2 (##)",
        "h3": "Titre 3 (###)",
        "h4": "Titre 4 (####)",
        "h5": "Titre 5 (#####)",
        "h6": "Titre 6 (######)",
        "quote": "Citation (>)",
        "code": "Code en ligne (`)",
        "codeBlock": "Bloc de code (```)",
        "link": "Lien",
        "image": "Image",
        "ul": "Liste à puces",
        "ol": "Liste numérotée",
        "hr": "Ligne horizontale",
        "table": "Tableau"
      },
      "err": {
        "EMPTY": "Veuillez saisir Markdown content",
        "PARSE": "Échec du rendu : veuillez vérifier la syntaxe Markdown"
      }
    },
    "image": {
      "format": "Format de sortie",
      "quality": "Qualité",
      "maxDim": "Dimension max",
      "original": "Taille d’origine",
      "dropHint": "Glissez-déposez une image ici, ou cliquez pour choisir (PNG / JPEG / WebP / GIF, etc.)",
      "before": "Original",
      "after": "Sortie",
      "saved": "Taille réduite de {{ratio}} %",
      "increased": "Taille augmentée de {{ratio}} %",
      "err": {
        "NOT_IMAGE": "Veuillez choisir an image file",
        "ENCODE": "Échec de l’encodage d’image : vérifiez que le navigateur prend en charge ce format, ou essayez une autre image"
      }
    },
    "jsonConvert": {
      "target": "Format cible",
      "targets": {
        "yaml": "YAML",
        "xml": "XML",
        "csv": "CSV"
      },
      "input": "Entrée JSON",
      "placeholder": "Collez JSON, e.g. [{\"id\":1,\"name\":\"a\"}]…",
      "err": {
        "PARSE": "Échec de l’analyse JSON : veuillez vérifier la syntaxe",
        "CONVERT": "Impossible de convertir vers le format cible (CSV requiert un tableau d’objets)"
      }
    },
    "xml": {
      "actions": {
        "format": "Embellir",
        "compress": "Minifier"
      },
      "indent": "Indentation",
      "indent2": "2 espaces",
      "indent4": "4 espaces",
      "input": "Entrée XML",
      "placeholder": "Collez du XML, ex. <root><item>a</item></root>…",
      "err": {
        "EMPTY": "Veuillez saisir XML content",
        "INVALID": "Échec du traitement : veuillez vérifier que le XML est valide"
      }
    },
    "xmlJson": {
      "indent": "Indentation",
      "indent2": "2 espaces",
      "indent4": "4 espaces",
      "input": "Entrée XML",
      "output": "Sortie JSON",
      "placeholder": "Collez du XML, ex. <root a=\"1\"><item>x</item></root>…",
      "err": {
        "EMPTY": "Veuillez saisir XML content",
        "PARSE": "Échec de l’analyse XML : veuillez vérifier la syntaxe"
      }
    },
    "unicode": {
      "format": "Formater",
      "formats": {
        "js": "JS \\uXXXX",
        "jsBrace": "JS \\u{…}",
        "codePoint": "Point de code U+",
        "htmlHex": "HTML &#x…;",
        "htmlDec": "HTML &#…;",
        "utf8": "Octets UTF-8"
      },
      "raw": "Texte brut",
      "encoded": "Texte encodé",
      "placeholderEncode": "Saisissez text, e.g. 中 / A / 😀…",
      "placeholderDecode": "Saisissez \\u4e2d, U+4E2D, &#x4E2D; ou E4 B8 AD…",
      "hint": "Le décodage accepte des notations mixtes ; l’encodage utilise le format sélectionné",
      "err": {
        "EMPTY": "Veuillez saisir content",
        "INVALID": "Impossible d’analyser : vérifiez la représentation Unicode / UTF-8"
      }
    },
    "colorPicker": {
      "picker": "Sélecteur",
      "input": "Valeur",
      "placeholder": "#3b82f6 / rgb(59,130,246)…",
      "eyedropper": "Pipette d’écran",
      "preview": "Aperçu de la couleur",
      "fields": {
        "hex": "HEX",
        "rgb": "RGB",
        "hsl": "HSL",
        "cssColor": "Couleur CSS",
        "cssBg": "Arrière-plan CSS",
        "htmlInline": "Style HTML"
      },
      "err": {
        "EMPTY": "Veuillez saisir a color",
        "INVALID": "Format de couleur non reconnu"
      }
    },
    "webColorTable": {
      "search": "Rechercher",
      "searchPlaceholder": "Nom / HEX / RGB…",
      "group": "Groupe",
      "groups": {
        "all": "Tout",
        "red": "Rouge",
        "orange": "Orange",
        "yellow": "Jaune",
        "green": "Vert",
        "cyan": "Cyan",
        "blue": "Bleu",
        "purple": "Violet",
        "pink": "Rose",
        "brown": "Brun",
        "white": "Blanc",
        "gray": "Gris",
        "black": "Noir"
      },
      "count": "Affichage de {{n}} / {{total}} couleurs",
      "empty": "Aucune couleur correspondante",
      "swatch": "Nuancier",
      "name": "Nom",
      "hex": "HEX",
      "rgb": "RGB",
      "copyName": "Nom",
      "copyHex": "HEX",
      "copyRgb": "RGB",
      "hint": "Couleurs nommées CSS (y compris alias Grey et RebeccaPurple) pour color / background."
    },
    "pinyin": {
      "input": "Chinois",
      "output": "Pinyin",
      "placeholder": "Saisissez Chinese, e.g. 你好世界…",
      "separator": "Séparateur",
      "separators": {
        "space": "Espace",
        "none": "Aucun",
        "dash": "Tiret -"
      },
      "letterCase": "Casse",
      "cases": {
        "lower": "Minuscules",
        "upper": "Majuscules"
      },
      "tone": "Activer les tons",
      "hint": "Utilise les lectures courantes ; les caractères polyphoniques utilisent la lecture par défaut",
      "err": {
        "EMPTY": "Veuillez saisir Chinese text"
      }
    },
    "length": {
      "value": "Valeur",
      "from": "Unité",
      "placeholder": "e.g. 1.5",
      "units": {
        "mm": "Millimètre mm",
        "cm": "Centimètre cm",
        "m": "Mètre m",
        "km": "Kilomètre km",
        "in": "Pouce in",
        "ft": "Pied ft",
        "yd": "Yard yd",
        "mi": "Mile mi",
        "nmi": "Mille marin nmi"
      },
      "err": {
        "EMPTY": "Veuillez saisir a number",
        "INVALID": "Veuillez saisir a valid number"
      }
    },
    "zhConvert": {
      "s2t": "Simplifié → Traditionnel",
      "t2s": "Traditionnel → Simplifié",
      "simplified": "Chinois simplifié",
      "traditional": "Chinois traditionnel",
      "placeholderS2t": "Saisissez Simplified Chinese…",
      "placeholderT2s": "Saisissez Traditional Chinese…",
      "hint": "Correspondance au niveau caractère ; les noms propres peuvent différer des dictionnaires de phrases OpenCC",
      "err": {
        "EMPTY": "Veuillez saisir text"
      }
    },
    "weight": {
      "value": "Valeur",
      "from": "Unité",
      "placeholder": "e.g. 1.5",
      "units": {
        "mg": "Milligramme mg",
        "g": "Gramme g",
        "kg": "Kilogramme kg",
        "t": "Tonne t",
        "oz": "Once oz",
        "lb": "Livre lb",
        "st": "Stone st"
      },
      "err": {
        "EMPTY": "Veuillez saisir a number",
        "INVALID": "Veuillez saisir a valid number"
      }
    },
    "textCounter": {
      "input": "Texte",
      "placeholder": "Collez or type text to count…",
      "emptyHint": "Les stats apparaîtront après saisie du texte",
      "stats": {
        "chars": "Caractères (avec espaces)",
        "charsNoSpace": "Caractères (sans espaces)",
        "words": "Mots",
        "cjk": "Caractères CJK",
        "lines": "Lignes",
        "paragraphs": "Paragraphes",
        "spaces": "Espace blanc",
        "bytes": "Octets UTF-8",
        "utf16Length": "Longueur UTF-16"
      }
    },
    "calendar": {
      "title": "{{year}}-{{month}}",
      "weekStart": "Début de semaine",
      "weekStarts": {
        "mon": "Lundi",
        "sun": "Dimanche"
      },
      "today": "Aujourd’hui",
      "prev": "Mois précédent",
      "next": "Mois suivant",
      "selected": "Date sélectionnée",
      "lunar": "Date lunaire",
      "ganZhi": "Pilier du jour {{day}}",
      "festivals": "Fêtes / termes",
      "restLabel": "Type de jour",
      "yi": "Propice",
      "ji": "À éviter",
      "legendZh": "Le rouge marque week-ends ou fêtes ; 休 = repos légal, 班 = jour travaillé de rattrapage. Almanach à droite.",
      "legendEn": "Les jours rouges sont week-ends ou fériés. L’anglais utilise les fêtes US (en-GB utilise les bank holidays UK).",
      "rest": {
        "off": "Férié",
        "work": "Jour ouvré",
        "weekend": "Week-end"
      },
      "weekdays": {
        "0": "Dim",
        "1": "Lun",
        "2": "Mar",
        "3": "Mer",
        "4": "Jeu",
        "5": "Ven",
        "6": "Sam"
      },
      "formats": {
        "iso": "ISO",
        "slash": "Slash",
        "locale": "Locale"
      }
    },
    "cssButton": {
      "label": "Libellé",
      "bg": "Arrière-plan",
      "color": "Texte",
      "hoverBg": "Survol",
      "borderColor": "Bordure",
      "radius": "Rayon",
      "paddingX": "Marge int. X",
      "paddingY": "Marge int. Y",
      "fontSize": "Taille de police",
      "borderWidth": "Épaisseur de bordure",
      "fontWeight": "Épaisseur",
      "shadow": "Ombre",
      "fullWidth": "Pleine largeur",
      "previewFallback": "Bouton",
      "css": "CSS",
      "html": "HTML"
    },
    "randomNumber": {
      "min": "Min",
      "max": "Max",
      "count": "Nombre",
      "decimals": "Décimales",
      "unique": "Unique",
      "generate": "Générer",
      "err": {
        "INVALID_RANGE": "Plage invalide : assurez min ≤ max et assez d’espace si unique",
        "INVALID_COUNT": "Le nombre doit être un entier de 1 à 1000",
        "INVALID_DECIMALS": "Les décimales doivent être un entier de 0 à 10"
      }
    },
    "randomString": {
      "length": "Longueur",
      "count": "Nombre",
      "preset": "Jeu de caractères",
      "presets": {
        "alnum": "Alphanumérique",
        "alpha": "Lettres",
        "hex": "Hex",
        "base64": "Base64",
        "custom": "Personnalisé"
      },
      "custom": "Caractères personnalisés",
      "customPlaceholder": "Saisissez allowed characters…",
      "generate": "Générer",
      "err": {
        "EMPTY_CHARSET": "Veuillez saisir a non-empty charset",
        "INVALID_LENGTH": "La longueur doit être un entier de 1 à 256",
        "INVALID_COUNT": "Le nombre doit être un entier de 1 à 100"
      }
    },
    "doodle": {
      "size": "Taille",
      "eraser": "Gomme",
      "clear": "Effacer",
      "download": "Exporter PNG",
      "hint": "Glissez sur le canevas pour dessiner ; souris et tactile pris en charge"
    },
    "calculator": {
      "expression": "Expression",
      "placeholder": "e.g. (1+2)*3 or sqrt(9)+pi",
      "functions": "Fonctions",
      "hint": "Prend en charge + - * / % ^ () et sqrt/abs/sin/cos/tan/ln/log/floor/ceil/round, plus pi et e",
      "err": {
        "EMPTY": "Veuillez saisir an expression",
        "SYNTAX": "expression syntax invalide",
        "DIV_ZERO": "Division par zéro"
      }
    },
    "codeImage": {
      "language": "Langue",
      "theme": "Thème",
      "themes": {
        "dark": "Dark",
        "light": "Light"
      },
      "lineNumbers": "Numéros de ligne",
      "padding": "Marge intérieure",
      "download": "Exporter PNG",
      "exporting": "Export…",
      "input": "Code",
      "preview": "Aperçu",
      "placeholder": "Collez code…"
    },
    "imageColor": {
      "dropHint": "Déposez ou choisissez une image (PNG / JPEG / WebP / GIF, etc.)",
      "empty": "Téléversez une image, puis cliquez pour échantillonner une couleur",
      "picked": "Couleur choisie",
      "preview": "Aperçu de la couleur",
      "clickHint": "Cliquez un pixel de l’image pour échantillonner",
      "err": {
        "NOT_IMAGE": "Veuillez choisir an image file",
        "LOAD": "Échec : load the image"
      }
    },
    "ascii": {
      "search": "Rechercher",
      "searchPlaceholder": "Décimal / hex / car. / nom…",
      "dec": "Déc",
      "hex": "Hex",
      "char": "Car.",
      "name": "Nom",
      "hint": "Les caractères de contrôle sans glyphe s’affichent en · ; copiez le car. ou \\xHH"
    },
    "watermark": {
      "text": "Texte du filigrane",
      "position": "Position",
      "positions": {
        "top-left": "Haut gauche",
        "top-right": "Haut droite",
        "center": "Centre",
        "bottom-left": "Bas gauche",
        "bottom-right": "Bas droite",
        "tile": "Mosaïque"
      },
      "color": "Couleur",
      "fontSize": "Taille de police",
      "opacity": "Opacité",
      "rotate": "Rotation",
      "gap": "Espacement",
      "dropHint": "Déposez ou choisissez an image to watermark",
      "original": "Original",
      "result": "Résultat",
      "download": "Télécharger PNG",
      "err": {
        "NOT_IMAGE": "Veuillez choisir an image file",
        "ENCODE": "Échec du traitement : essayez une autre image"
      }
    },
    "caseConvert": {
      "mode": "Mode",
      "placeholder": "Saisissez text to convert…",
      "modes": {
        "upper": "UPPER CASE",
        "lower": "lower case",
        "title": "Title Case",
        "sentence": "Sentence case",
        "swap": "sWAP cASE",
        "camel": "camelCase",
        "pascal": "PascalCase",
        "snake": "snake_case",
        "kebab": "kebab-case",
        "constant": "CONSTANT_CASE"
      },
      "err": {
        "EMPTY": "Veuillez saisir some text"
      }
    },
    "bmi": {
      "unit": "Système d’unités",
      "metric": "Métrique (cm / kg)",
      "imperial": "Impérial (in / lb)",
      "heightCm": "Taille (cm, ou mètres)",
      "heightIn": "Taille (pouces)",
      "weightKg": "Poids (kg)",
      "weightLb": "Poids (lb)",
      "bmi": "BMI",
      "category": "Catégorie",
      "categories": {
        "underweight": "Insuffisance pondérale",
        "normal": "Normal",
        "overweight": "Surpoids",
        "obese": "Obésité"
      },
      "hint": "Les catégories suivent les seuils OMS adultes à titre indicatif — pas un avis médical.",
      "err": {
        "INVALID": "Saisissez a valid height and weight",
        "RANGE": "Les valeurs sont hors d’une plage raisonnable ; vérifiez les unités"
      }
    },
    "placeholder": {
      "width": "Largeur",
      "height": "Hauteur",
      "bg": "Arrière-plan",
      "fg": "Couleur du texte",
      "text": "Texte",
      "textPlaceholder": "Par défaut : dimensions",
      "download": "Télécharger PNG",
      "err": {
        "INVALID_SIZE": "La taille doit être un entier entre 16 et 4000",
        "INVALID_COLOR": "La couleur doit être #RGB ou #RRGGBB"
      }
    },
    "imageMerge": {
      "direction": "Disposition",
      "directions": {
        "horizontal": "Horizontal",
        "vertical": "Vertical",
        "grid": "Grille"
      },
      "gap": "Espacement (px)",
      "dropHint": "Ajoutez des images une par une (jusqu’à {{max}})",
      "download": "Télécharger le PNG fusionné",
      "err": {
        "NOT_IMAGE": "Veuillez choisir an image file",
        "TOO_MANY": "Limite d’images atteinte",
        "ENCODE": "Échec de la fusion ; veuillez réessayer",
        "EMPTY": "Ajoutez au moins une image"
      }
    },
    "cronGen": {
      "preset": "Préréglages",
      "presetPick": "Choisir un préréglage…",
      "presets": {
        "everyMinute": "Chaque minute",
        "hourly": "Toutes les heures (à l’heure)",
        "daily": "Tous les jours à 00:00",
        "weekly": "Chaque lun. 00:00",
        "monthly": "Le 1er de chaque mois à 00:00"
      },
      "fields": {
        "minute": "Minute",
        "hour": "Heure",
        "day": "Jour du mois",
        "month": "Mois",
        "weekday": "Jour de la semaine"
      },
      "modes": {
        "every": "Tous (*)",
        "value": "Valeur spécifique",
        "range": "Plage",
        "step": "Pas",
        "list": "Liste"
      },
      "listPlaceholder": "e.g. 1,3,5",
      "everyHint": "Correspond à chaque valeur de ce champ",
      "expression": "Expression",
      "openParser": "Aperçu dans l’analyseur Cron",
      "hint": "5 champs standard : minute heure jour mois jour_semaine (0 = dimanche)",
      "err": {
        "INVALID_FIELD": "Valeur de champ invalide ; vérifiez les plages et listes"
      }
    },
    "uaParser": {
      "input": "User-Agent",
      "placeholder": "Collez a User-Agent string…",
      "useCurrent": "Utiliser le navigateur actuel",
      "field": "Champ",
      "name": "Nom",
      "version": "Version",
      "extra": "Extra",
      "fields": {
        "browser": "Navigateur",
        "engine": "Moteur",
        "os": "OS",
        "device": "Appareil",
        "cpu": "CPU"
      },
      "err": {
        "EMPTY": "Veuillez saisir a User-Agent"
      }
    },
    "latex": {
      "input": "LaTeX",
      "placeholder": "e.g. E = mc^2 or \\frac{a}{b}",
      "preview": "Aperçu",
      "displayMode": "Mode affichage",
      "copyHtml": "Copier HTML",
      "symbols": "Symboles rapides",
      "formulasTitle": "Formules classiques",
      "downloadPng": "Exporter PNG",
      "downloadJpg": "Exporter JPG",
      "downloadSvg": "Exporter SVG",
      "exporting": "Export…",
      "empty": "Saisissez a formula to preview",
      "hint": "Cliquez un symbole pour l’insérer au curseur ; les formules classiques remplacent l’éditeur. Rendu par KaTeX ; les macros exotiques peuvent échouer.",
      "categories": {
        "operators": "Opérateurs",
        "relations": "Relations",
        "greek": "Lettres grecques",
        "trig": "Trigonométrie",
        "calculus": "Calcul",
        "sumprod": "Sommes et produits",
        "set": "Théorie des ensembles",
        "logic": "Logique",
        "arrows": "Flèches",
        "matrix": "Matrices et vecteurs",
        "special": "Spécial"
      },
      "formulas": {
        "einstein": "Masse–énergie",
        "quadratic": "Formule quadratique",
        "pythagorean": "Théorème de Pythagore",
        "euler": "Identité d’Euler",
        "binomial": "Théorème binomial",
        "taylor": "Série de Taylor",
        "gaussian": "Intégrale de Gauss",
        "cauchySchwarz": "Cauchy–Schwarz",
        "bayes": "Théorème de Bayes",
        "derivative": "Définition de la dérivée",
        "fourier": "Transformée de Fourier",
        "navierStokes": "Navier–Stokes",
        "maxwell": "Équation de Maxwell",
        "schrodinger": "Équation de Schrödinger",
        "normalDist": "Loi normale",
        "matrix2x2Det": "Déterminant 2×2"
      },
      "err": {
        "EMPTY": "Veuillez saisir a formula",
        "RENDER": "Échec du rendu : {{message}}"
      }
    },
    "countdown": {
      "hours": "H",
      "minutes": "M",
      "seconds": "S",
      "start": "Démarrer",
      "pause": "Pause",
      "resume": "Reprendre",
      "reset": "Réinitialiser",
      "done": "Temps écoulé !",
      "err": {
        "INVALID": "Saisissez a valid hours / minutes / seconds",
        "ZERO": "La durée doit être supérieure à 0"
      }
    },
    "stopwatch": {
      "start": "Démarrer",
      "pause": "Pause",
      "resume": "Reprendre",
      "reset": "Réinitialiser",
      "lap": "Tour",
      "lapIndex": "Tour",
      "lapTime": "Temps au tour",
      "totalTime": "Total"
    },
    "svgPng": {
      "input": "Source SVG",
      "placeholder": "Collez SVG markup…",
      "dropHint": "Déposez ou choisissez a .svg file",
      "scale": "Échelle",
      "transparent": "Fond transparent",
      "download": "Télécharger PNG",
      "sizeHint": "Source {{sw}}×{{sh}} → sortie {{pw}}×{{ph}}",
      "err": {
        "EMPTY": "Veuillez saisir SVG",
        "INVALID_SVG": "SVG non valide",
        "INVALID_SIZE": "Taille de sortie invalide (vérifiez l’échelle ; bord max 8192)",
        "ENCODE": "Échec de la conversion ; vérifiez le SVG ou réduisez l’échelle"
      }
    },
    "imageFrame": {
      "borderWidth": "Épaisseur de bordure",
      "borderColor": "Couleur de bordure",
      "radius": "Rayon",
      "shadowBlur": "Flou de l’ombre",
      "shadowOffsetY": "Décalage de l’ombre",
      "shadowOpacity": "Opacité de l’ombre",
      "dropHint": "Déposez ou choisissez an image",
      "download": "Télécharger PNG",
      "err": {
        "NOT_IMAGE": "Veuillez choisir an image file",
        "ENCODE": "Échec du traitement ; essayez une autre image"
      }
    },
    "imageAdjust": {
      "brightness": "Luminosité",
      "contrast": "Contraste",
      "saturate": "Saturation",
      "hue": "Teinte",
      "reset": "Réinitialiser",
      "dropHint": "Déposez ou choisissez an image to adjust",
      "original": "Original",
      "download": "Télécharger PNG",
      "err": {
        "NOT_IMAGE": "Veuillez choisir an image file",
        "ENCODE": "Échec du traitement ; essayez une autre image"
      }
    },
    "gifFrames": {
      "dropHint": "Déposez ou choisissez a GIF file",
      "meta": "{{w}}×{{h}} · {{n}} frames",
      "download": "Télécharger",
      "downloadAll": "Télécharger toutes les frames",
      "err": {
        "NOT_GIF": "Veuillez choisir a GIF file",
        "EMPTY": "Le fichier est vide",
        "PARSE": "Échec : parse GIF"
      }
    },
    "imageCrop": {
      "aspect": "Ratio",
      "aspects": {
        "free": "Libre",
        "1_1": "1:1",
        "4_3": "4:3",
        "3_4": "3:4",
        "16_9": "16:9",
        "9_16": "9:16"
      },
      "x": "X",
      "y": "Y",
      "width": "W",
      "height": "H",
      "dropHint": "Déposez ou choisissez an image to crop",
      "hint": "Glissez pour sélectionner en mode libre, ou modifiez les valeurs ci-dessous",
      "download": "Télécharger PNG",
      "err": {
        "NOT_IMAGE": "Veuillez choisir an image file",
        "ENCODE": "Échec du recadrage ; veuillez réessayer",
        "INVALID": "crop region invalide"
      }
    },
    "mbti": {
      "progress": "Répondu {{done}} / {{total}}",
      "questionIndex": "Question {{n}} / {{total}}",
      "prev": "Précédent",
      "next": "Suivant",
      "submit": "Voir le résultat",
      "reset": "Effacer",
      "retake": "Repasser",
      "yourType": "Votre tendance de type",
      "hint": "Choisissez l’option qui vous correspond le mieux ; soumettez quand tout est répondu.",
      "disclaimer": "Quiz simplifié à des fins de divertissement uniquement — pas une évaluation clinique.",
      "dims": {
        "EI": "Extraversion E / Introversion I",
        "SN": "Sensation S / Intuition N",
        "TF": "Pensée T / Sentiment F",
        "JP": "Jugement J / Perception P"
      }
    },
    "textCard": {
      "theme": "Thème",
      "themes": {
        "slate": "Slate",
        "ocean": "Ocean",
        "sunset": "Sunset",
        "forest": "Forest",
        "mono": "Mono",
        "paper": "Paper"
      },
      "align": "Alignement",
      "aligns": {
        "left": "Gauche",
        "center": "Centre",
        "right": "Droite"
      },
      "fontSize": "Taille de police",
      "padding": "Marge intérieure",
      "width": "Largeur",
      "title": "Titre",
      "titlePlaceholder": "Titre optionnel…",
      "body": "Corps",
      "bodyPlaceholder": "Saisissez text for the card…",
      "preview": "Aperçu",
      "empty": "Saisissez a title or body to preview",
      "download": "Exporter PNG",
      "exporting": "Export…"
    },
    "imageCard": {
      "shadow": "Ombre",
      "padding": "Marge intérieure",
      "radius": "Rayon du bloc",
      "width": "Largeur",
      "textPosition": "Position de la légende",
      "positions": {
        "below": "Sous la photo",
        "above": "Au-dessus de la photo"
      },
      "align": "Alignement",
      "aligns": {
        "left": "Gauche",
        "center": "Centre",
        "right": "Droite"
      },
      "textPadding": "Marge du texte",
      "textBg": "Fond du texte",
      "titleSize": "Taille du titre",
      "subtitleSize": "Taille du sous-titre",
      "rotate": "Rotation photo",
      "backdrop": "Arrière-plan",
      "backdropModes": {
        "preset": "Préréglage",
        "color": "Plein",
        "gradient": "Dégradé"
      },
      "backdropColor": "Couleur d’arrière-plan",
      "gradientFrom": "De",
      "gradientTo": "Vers",
      "gradientAngle": "Angle",
      "backdrops": {
        "paper": "Paper",
        "fog": "Fog",
        "night": "Night",
        "mint": "Mint",
        "sand": "Sand",
        "ink": "Ink",
        "sunset": "Sunset",
        "ocean": "Ocean",
        "lavender": "Lavender",
        "peach": "Peach",
        "aurora": "Aurora",
        "charcoal": "Charcoal"
      },
      "title": "Titre",
      "titlePlaceholder": "Titre de la carte…",
      "subtitle": "Sous-titre",
      "subtitlePlaceholder": "Ligne d’appui…",
      "dropHint": "Déposez ou choisissez an image for the card",
      "empty": "Téléversez une image pour prévisualiser la carte",
      "download": "Exporter PNG",
      "exporting": "Export…",
      "err": {
        "NOT_IMAGE": "Veuillez choisir an image file",
        "ENCODE": "Échec de l’export ; essayez une autre image"
      }
    },
    "codeHighlight": {
      "language": "Langue",
      "theme": "Thème",
      "themes": {
        "dark": "Dark",
        "light": "Light"
      },
      "lineNumbers": "Numéros de ligne",
      "input": "Code",
      "preview": "Aperçu coloré",
      "placeholder": "Collez code…",
      "copyCode": "Copier le code",
      "copyHtml": "Copier HTML",
      "hint": "Propulsé par Prism ; copiez le snippet HTML pour blogs et docs."
    },
    "imageBase64": {
      "upload": "Image → Base64",
      "uploadHint": "Déposez ou choisissez an image",
      "copyDataUrl": "Copier Data URL",
      "base64Out": "Base64",
      "paste": "Base64 → Image",
      "pastePlaceholder": "Collez a Data URL or raw Base64…",
      "err": {
        "EMPTY": "Saisissez Base64 or choose an image",
        "INVALID_BASE64": "Base64 invalide",
        "NOT_IMAGE": "Veuillez choisir an image file"
      }
    },
    "imageIco": {
      "mode": "Mode",
      "toIco": "Image → ICO",
      "fromIco": "ICO → PNG",
      "sizes": "Tailles",
      "uploadImageHint": "Déposez ou choisissez a PNG / JPG / WebP image",
      "uploadIcoHint": "Déposez ou choisissez a .ico file",
      "convert": "Créer ICO",
      "converting": "Traitement…",
      "downloadIco": "Télécharger ICO",
      "downloadPng": "Télécharger PNG",
      "extracted": "{{n}} tailles extraites de {{name}}",
      "err": {
        "NOT_IMAGE": "Veuillez choisir an image file",
        "NOT_ICO": "Veuillez choisir an ICO file",
        "USE_FROM_ICO": "Passez à « ICO → PNG » pour ouvrir un fichier ICO",
        "NO_SIZES": "Sélectionnez au moins une taille",
        "EMPTY": "Le fichier est vide",
        "INVALID_ICO": "or corrupt ICO file invalide",
        "ENCODE": "Échec de la conversion ; essayez une autre image"
      }
    },
    "hsvCmyk": {
      "preview": "Aperçu de la couleur"
    },
    "aiPrompts": {
      "search": "Rechercher",
      "searchPlaceholder": "Mots-clés…",
      "category": "Catégorie",
      "empty": "Aucun prompt correspondant",
      "cat": {
        "all": "Tout",
        "writing": "Écriture",
        "coding": "Code",
        "translate": "Traduire",
        "marketing": "Marketing",
        "learning": "Apprentissage",
        "career": "Carrière"
      }
    },
    "mdMindmap": {
      "input": "Markdown",
      "placeholder": "# Topic\n## Branch\n- Point…",
      "preview": "Carte mentale",
      "theme": "Thème",
      "themes": {
        "sky": "Sky",
        "forest": "Forest",
        "sunset": "Sunset",
        "grape": "Grape",
        "ocean": "Ocean",
        "mono": "Mono"
      },
      "zoomIn": "Zoom avant",
      "zoomOut": "Zoom arrière",
      "zoomReset": "Réinit. zoom",
      "zoomHint": "Maintenez Ctrl / ⌘ et faites défiler pour zoomer l’aperçu",
      "downloadSvg": "Exporter SVG",
      "downloadPng": "Exporter PNG",
      "download": "Exporter SVG",
      "exporting": "Export…",
      "empty": "Saisissez des titres ou listes Markdown pour générer une carte",
      "err": {
        "EMPTY": "Veuillez saisir Markdown"
      }
    },
    "mermaid": {
      "input": "Mermaid",
      "placeholder": "flowchart TD\n  A-->B",
      "preview": "Aperçu",
      "theme": "Thème",
      "themes": {
        "default": "Default",
        "neutral": "Neutral",
        "forest": "Forest",
        "dark": "Dark",
        "ocean": "Ocean",
        "sunset": "Sunset",
        "mono": "Mono"
      },
      "zoomIn": "Zoom avant",
      "zoomOut": "Zoom arrière",
      "zoomReset": "Réinit. zoom",
      "zoomHint": "Maintenez Ctrl / ⌘ et faites défiler pour zoomer l’aperçu",
      "downloadSvg": "Exporter SVG",
      "downloadPng": "Exporter PNG",
      "download": "Exporter SVG",
      "exporting": "Export…",
      "empty": "Saisissez Mermaid syntax to render",
      "rendering": "Rendu…",
      "err": {
        "RENDER": "Échec du rendu : {{message}}"
      }
    },
    "cssGradient": {
      "type": "Type",
      "linear": "Linéaire",
      "radial": "Radial",
      "angle": "Angle",
      "shape": "Forme",
      "preview": "Aperçu du dégradé",
      "stops": "Arrêts",
      "addStop": "Ajouter un arrêt",
      "position": "Position %",
      "removeStop": "Supprimer",
      "css": "CSS",
      "presetsTitle": "Préréglages",
      "presetCategories": {
        "warm": "Warm",
        "cool": "Cool",
        "nature": "Nature green",
        "pink": "Romantic pink",
        "purple": "Mysterious purple",
        "dark": "Dark",
        "light": "Light",
        "rainbow": "Multicolor",
        "sunset": "Sunset",
        "ocean": "Ocean"
      },
      "presetNames": {
        "warm-golden": "Golden sun",
        "warm-peach": "Peach",
        "warm-coral": "Coral",
        "warm-amber": "Amber",
        "warm-spice": "Spice orange",
        "warm-rose-gold": "Rose gold",
        "warm-papaya": "Papaya cream",
        "warm-flame": "Flame",
        "warm-honey": "Honey gold",
        "warm-terracotta": "Terracotta",
        "warm-mango": "Mango",
        "warm-autumn": "Autumn",
        "warm-cinnamon": "Cinnamon",
        "warm-tangerine": "Tangerine",
        "warm-sunset-orange": "Sunset orange",
        "warm-brick": "Brick red",
        "warm-caramel": "Caramel",
        "warm-radial": "Warm glow",
        "warm-saffron": "Saffron",
        "warm-burnt": "Burnt sienna",
        "warm-apricot": "Apricot",
        "cool-arctic": "Arctic blue",
        "cool-ice": "Ice blue",
        "cool-frost": "Frost",
        "cool-steel": "Steel gray",
        "cool-mint-ice": "Mint ice",
        "cool-glacier": "Glacier",
        "cool-skyline": "Skyline",
        "cool-polar": "Polar glow",
        "cool-nordic": "Nordic gray",
        "cool-periwinkle": "Periwinkle",
        "cool-cobalt": "Cobalt",
        "cool-teal-breeze": "Teal breeze",
        "cool-sapphire": "Sapphire",
        "cool-winter": "Winter",
        "cool-azure": "Azure tri-color",
        "cool-denim": "Denim blue",
        "cool-moonlight": "Moonlight",
        "cool-cyan": "Cyan blue",
        "cool-harbor": "Harbor",
        "cool-iceberg": "Iceberg",
        "nature-forest": "Forest",
        "nature-moss": "Moss",
        "nature-jungle": "Jungle",
        "nature-spring": "Spring",
        "nature-fern": "Fern",
        "nature-matcha": "Matcha",
        "nature-emerald": "Emerald",
        "nature-leaf": "Leaf glow",
        "nature-bamboo": "Bamboo",
        "nature-pine": "Pine forest",
        "nature-sage": "Sage",
        "nature-meadow": "Meadow",
        "nature-rainforest": "Rainforest",
        "nature-olive": "Olive",
        "nature-cypress": "Cypress",
        "nature-mint": "Mint",
        "nature-tea": "Tea garden",
        "nature-canopy": "Canopy",
        "nature-dew": "Morning dew",
        "nature-avocado": "Avocado",
        "pink-blush": "Blush",
        "pink-rose": "Rose",
        "pink-cotton": "Cotton candy",
        "pink-sakura": "Sakura",
        "pink-cherry": "Cherry",
        "pink-bubble": "Bubble gum",
        "pink-dream": "Dream pink",
        "pink-valentine": "Valentine",
        "pink-lotus": "Lotus",
        "pink-peony": "Peony",
        "pink-strawberry": "Strawberry",
        "pink-fairy": "Fairy pink",
        "pink-magnolia": "Magnolia",
        "pink-petal": "Petal",
        "pink-candy": "Candy pink",
        "pink-radial": "Pink glow",
        "pink-rosewater": "Rosewater",
        "pink-ballet": "Ballet pink",
        "purple-galaxy": "Galaxy",
        "purple-mystic": "Mystic purple",
        "purple-amethyst": "Amethyst",
        "purple-velvet": "Velvet purple",
        "purple-neon": "Neon purple",
        "purple-twilight": "Twilight purple",
        "purple-royal": "Royal purple",
        "purple-orb": "Purple orb",
        "purple-lilac": "Lilac",
        "purple-indigo": "Indigo purple",
        "purple-plum": "Plum",
        "purple-cosmic": "Cosmic purple",
        "purple-dusk": "Purple dusk",
        "purple-wine": "Wine purple",
        "purple-iris": "Iris",
        "purple-void": "Void",
        "purple-haze": "Purple haze",
        "purple-orchid": "Orchid",
        "purple-aurora": "Purple aurora",
        "purple-midnight": "Midnight purple",
        "dark-charcoal": "Charcoal",
        "dark-midnight": "Midnight",
        "dark-slate": "Slate",
        "dark-eclipse": "Eclipse",
        "dark-carbon": "Carbon",
        "dark-noir": "Noir",
        "dark-abyss": "Abyss",
        "dark-spotlight": "Spotlight dark",
        "dark-obsidian": "Obsidian",
        "dark-graphite": "Graphite",
        "dark-onyx": "Onyx",
        "dark-storm": "Storm night",
        "dark-ink": "Ink black",
        "dark-vignette": "Vignette",
        "dark-smoke": "Smoke gray",
        "dark-raven": "Raven",
        "dark-void": "Void black",
        "light-cloud": "Cloud",
        "light-pearl": "Pearl",
        "light-mist": "Mist",
        "light-cream": "Cream",
        "light-linen": "Linen",
        "light-sand": "Sand",
        "light-lavender": "Lavender mist",
        "light-glow": "Soft glow",
        "light-ivory": "Ivory",
        "light-snow": "Snow white",
        "light-blush": "Blush",
        "light-morning": "Morning",
        "light-silk": "Silk",
        "light-frost": "Frost white",
        "light-champagne": "Champagne",
        "light-dawn": "Dawn",
        "light-powder": "Powder blue",
        "light-cotton": "Cotton white",
        "rainbow-classic": "Classic rainbow",
        "rainbow-neon": "Neon multicolor",
        "rainbow-candy": "Candy",
        "rainbow-aurora": "Aurora",
        "rainbow-sunset": "Sunset blend",
        "rainbow-pastel": "Pastel",
        "rainbow-vivid": "Vivid tri-color",
        "rainbow-prism": "Prism",
        "rainbow-spectrum": "Spectrum",
        "rainbow-holo": "Holographic",
        "rainbow-pop": "Pop art",
        "rainbow-soda": "Soda pop",
        "rainbow-tropical": "Tropical",
        "rainbow-laser": "Laser",
        "rainbow-universe": "Universe",
        "rainbow-dream": "Dream color",
        "rainbow-galaxy": "Galaxy color",
        "rainbow-confetti": "Confetti",
        "rainbow-cyber": "Cyber",
        "rainbow-retro": "Retro duo",
        "rainbow-synth": "Synthwave",
        "rainbow-cotton": "Cotton candy",
        "rainbow-electric": "Electric",
        "rainbow-sunrise": "Sunrise blend",
        "sunset-dusk": "Dusk",
        "sunset-horizon": "Horizon",
        "sunset-glow": "Afterglow",
        "sunset-beach": "Beach sunset",
        "sunset-desert": "Desert dusk",
        "sunset-evening": "Evening",
        "sunset-fire": "Fire sky",
        "sunset-radial": "Sunset radial",
        "sunset-amber": "Amber dusk",
        "sunset-crimson": "Crimson dusk",
        "sunset-twilight": "Twilight",
        "sunset-mango": "Mango dusk",
        "sunset-ember": "Ember",
        "sunset-sky": "Sky dusk",
        "sunset-sahara": "Sahara",
        "sunset-golden": "Golden dusk",
        "sunset-coast": "Coastal dusk",
        "sunset-violet": "Violet dusk",
        "sunset-radial-glow": "Sun disc glow",
        "sunset-lake": "Lake dusk",
        "ocean-deep": "Deep ocean",
        "ocean-wave": "Ocean wave",
        "ocean-lagoon": "Lagoon",
        "ocean-reef": "Coral reef",
        "ocean-abyss": "Ocean abyss",
        "ocean-tide": "Tide",
        "ocean-coral": "Sea blue",
        "ocean-bubble": "Sea bubble",
        "ocean-marine": "Marine blue",
        "ocean-aqua": "Aqua",
        "ocean-storm": "Storm sea",
        "ocean-seafoam": "Seafoam",
        "ocean-caribbean": "Caribbean",
        "ocean-pacific": "Pacific",
        "ocean-arctic": "Arctic sea",
        "ocean-turquoise": "Turquoise",
        "ocean-depth": "Deep glow",
        "ocean-surf": "Surf",
        "ocean-kelp": "Kelp",
        "ocean-mist": "Sea mist",
        "ocean-pearl": "Sea pearl"
      }
    },
    "imageToPaper": {
      "paper": "Paper",
      "orientation": "Orientation",
      "portrait": "Portrait",
      "landscape": "Paysage",
      "fit": "Ajuster",
      "contain": "Contenir",
      "cover": "Couvrir",
      "margin": "Marge (mm)",
      "uploadHint": "Déposez ou choisissez an image",
      "downloadPng": "Télécharger PNG",
      "downloadPdf": "Exporter PDF",
      "exporting": "Export…",
      "err": {
        "NOT_IMAGE": "Veuillez choisir an image file",
        "INVALID_MARGIN": "Marge invalide",
        "INVALID_IMAGE": "image size invalide"
      }
    },
    "mdToImage": {
      "gfm": "GFM",
      "breaks": "Sauts de ligne → <br>",
      "font": "Police",
      "fonts": {
        "sans": "Sans empattement",
        "serif": "Avec empattement",
        "mono": "Monospace",
        "song": "Song (empattement CJK)",
        "hei": "Hei (sans empattement CJK)"
      },
      "fontSize": "Taille de police",
      "width": "Largeur",
      "padding": "Marge intérieure",
      "lineHeight": "Interligne",
      "fg": "Couleur du texte",
      "bg": "Arrière-plan",
      "download": "Exporter PNG",
      "exporting": "Export…",
      "input": "Markdown",
      "placeholder": "# Title\nBody…",
      "preview": "Aperçu",
      "err": {
        "EMPTY": "Veuillez saisir Markdown",
        "PARSE": "Échec de l’analyse",
        "INVALID_COLOR": "La couleur doit être #RGB ou #RRGGBB",
        "INVALID_SIZE": "Taille de police / largeur / padding / interligne hors plage",
        "INVALID_FONT": "Police non prise en charge"
      }
    },
    "chartGenerator": {
      "type": "Type",
      "types": {
        "bar": "Barres",
        "hbar": "Barres horizontales",
        "line": "Lignes",
        "area": "Aires",
        "pie": "Camembert",
        "doughnut": "Anneau",
        "scatter": "Nuage de points"
      },
      "bar": "Barres",
      "line": "Lignes",
      "pie": "Camembert",
      "title": "Titre",
      "seriesLabel": "Libellé de série",
      "legend": "Légende",
      "legends": {
        "top": "Haut",
        "bottom": "Bas",
        "left": "Gauche",
        "right": "Droite",
        "none": "Masqué"
      },
      "colorScheme": "Palette",
      "schemes": {
        "vibrant": "Vibrant",
        "pastel": "Pastel",
        "ocean": "Ocean",
        "sunset": "Sunset",
        "forest": "Forest",
        "mono": "Mono",
        "rainbow": "Arc-en-ciel"
      },
      "xLabel": "Libellé axe X",
      "yLabel": "Libellé axe Y",
      "xLabelPlaceholder": "e.g. Month",
      "yLabelPlaceholder": "e.g. Sales",
      "color": "Couleur",
      "width": "Largeur",
      "height": "Hauteur",
      "data": "Données (CSV)",
      "dataPlaceholder": "label,value\napple,30\nbanana,20",
      "preview": "Aperçu",
      "downloadSvg": "Télécharger SVG",
      "downloadPng": "Télécharger PNG",
      "copySvg": "Copier SVG",
      "err": {
        "EMPTY": "Veuillez saisir data",
        "INVALID": "data format invalide",
        "NO_NUMERIC": "Aucune valeur numérique trouvée"
      }
    },
    "css3Generator": {
      "linked": "Lier les coins",
      "topLeft": "Haut gauche",
      "topRight": "Haut droite",
      "bottomRight": "Bas droite",
      "bottomLeft": "Bas gauche",
      "offsetX": "Décalage X",
      "offsetY": "Décalage Y",
      "blur": "Flou",
      "spread": "Étendue",
      "color": "Couleur",
      "inset": "Inset",
      "translateX": "Translation X",
      "translateY": "Translation Y",
      "rotate": "Rotation",
      "scale": "Échelle",
      "skewX": "Biseau X",
      "property": "Propriété",
      "duration": "Durée (s)",
      "timing": "Timing",
      "delay": "Délai (s)",
      "brightness": "Luminosité",
      "contrast": "Contraste",
      "saturate": "Saturation",
      "grayscale": "Niveaux de gris",
      "hueRotate": "Rotation de teinte",
      "preview": "Aperçu",
      "previewLabel": "Aperçu",
      "css": "CSS",
      "modules": {
        "borderRadius": "Rayon",
        "boxShadow": "Ombre portée",
        "textShadow": "Ombre de texte",
        "transform": "Transform",
        "transition": "Transition",
        "filter": "Filtre"
      }
    },
    "pdf-merge": {
      "hint": "Fusion locale — rien n’est téléversé. Préférez des fichiers < 50 Mo.",
      "drop": "Déposez plusieurs PDF",
      "run": "Merge et télécharger",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-split": {
      "hint": "Divise en un PDF par page et télécharge chacun.",
      "asZip": "Télécharger en ZIP",
      "drop": "Déposez un PDF",
      "run": "Split et télécharger",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-delete-pages": {
      "hint": "Pages à supprimer, ex. 1,3-5. Au moins une page doit rester.",
      "pages": "Pages à supprimer",
      "run": "Delete et télécharger",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-extract-pages": {
      "hint": "Pages à extraire, ex. 1,3-5.",
      "pages": "Pages à extraire",
      "run": "Extract et télécharger",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-reorder": {
      "hint": "Utilisez les flèches pour réordonner les pages, puis exportez.",
      "pagesUnit": "pages",
      "pageLabel": "Page {{n}}",
      "run": "Apply et télécharger",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-rotate": {
      "hint": "Choisissez un angle pour toutes les pages ou les pages sélectionnées.",
      "allPages": "Toutes les pages",
      "pages": "Pages",
      "run": "Rotate et télécharger",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-to-image": {
      "hint": "Rendu local ; les gros fichiers peuvent être lents.",
      "scale": "Échelle",
      "pages": "Pages (optionnel)",
      "pagesAll": "Laisser vide pour toutes",
      "run": "Exporter les images",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "images-to-pdf": {
      "hint": "Une image par page à la taille en pixels.",
      "drop": "Déposez des images",
      "run": "Créer le PDF",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-viewer": {
      "hint": "Aperçu local — rien n’est téléversé.",
      "prev": "Préc.",
      "next": "Suivant",
      "scale": "Échelle",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-page-numbers": {
      "hint": "Le format prend en charge {n} et {total}.",
      "format": "Formater",
      "fontSize": "Taille de police",
      "startFrom": "Commencer à",
      "run": "Add et télécharger",
      "pos": {
        "bottom-center": "Bas centre",
        "bottom-left": "Bas gauche",
        "bottom-right": "Bas droite",
        "top-center": "Haut centre"
      },
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-header-footer": {
      "hint": "Fournissez au moins un en-tête ou un pied de page.",
      "header": "Header",
      "footer": "Pied de page",
      "fontSize": "Taille de police",
      "run": "Apply et télécharger",
      "align": {
        "left": "Gauche",
        "center": "Centre",
        "right": "Droite"
      },
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-insert-image": {
      "hint": "L’origine est en bas à gauche de la page (coordonnées PDF).",
      "pdf": "Fichier PDF",
      "image": "Image (PNG/JPG)",
      "allPages": "Toutes les pages",
      "pages": "Pages",
      "width": "Largeur",
      "run": "Insert et télécharger",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-add-text": {
      "hint": "L’origine est en bas à gauche ; l’Unicode complexe peut être limité.",
      "text": "Texte",
      "allPages": "Toutes les pages",
      "pages": "Pages",
      "fontSize": "Taille de police",
      "color": "Couleur",
      "run": "Add et télécharger",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-sign": {
      "hint": "Signature visuelle (superposition d’image), pas un certificat numérique.",
      "upload": "Téléverser la signature",
      "draw": "Dessiner la signature",
      "allPages": "Toutes les pages",
      "pages": "Pages",
      "width": "Largeur",
      "run": "Sign et télécharger",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-metadata": {
      "hint": "Modifiez le titre, l’auteur et d’autres métadonnées, puis téléchargez.",
      "pages": "{{n}} pages",
      "run": "Save et télécharger",
      "fields": {
        "title": "Titre",
        "author": "Auteur",
        "subject": "Sujet",
        "keywords": "Mots-clés",
        "creator": "Créateur",
        "producer": "Producteur"
      },
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-encrypt": {
      "hint": "Définissez le mot de passe d’ouverture et les permissions. Le support des lecteurs varie.",
      "userPassword": "Mot de passe utilisateur",
      "ownerPassword": "Mot de passe propriétaire",
      "ownerHint": "Par défaut : mot de passe utilisateur si vide",
      "run": "Encrypt et télécharger",
      "perm": {
        "printing": "Autoriser l’impression",
        "copying": "Autoriser la copie",
        "modifying": "Autoriser la modification",
        "annotating": "Autoriser l’annotation"
      },
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-crop": {
      "hint": "Marges en points PDF (pt ≈ 1/72 pouce).",
      "top": "Haut",
      "right": "Droite",
      "bottom": "Bas",
      "left": "Gauche",
      "run": "Crop et télécharger",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-grayscale": {
      "hint": "Niveaux de gris visuels via re-rasterisation ; le texte ne restera pas sélectionnable.",
      "run": "Convert et télécharger",
      "errors": {
        "EMPTY": "Veuillez compléter the input",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "pdf-annotate": {
      "hint": "Ouvrez un PDF et dessinez des annotations : stylo, surlignage, rectangle, ellipse, cercle, ligne et texte.",
      "drop": "Déposez un PDF",
      "stroke": "Trait",
      "fontSize": "Taille de police",
      "scale": "Zoom",
      "undo": "Annuler",
      "clearPage": "Effacer la page",
      "prev": "Préc.",
      "next": "Suivant",
      "count": "{{n}} annotation(s)",
      "textPrompt": "Saisissez annotation text",
      "needVisitPage": "Ouvrez d’abord la page {{n}} pour qu’elle puisse être rendue avant l’export",
      "run": "Exporter le PDF annoté",
      "kinds": {
        "pen": "Stylo",
        "highlight": "Surlignage",
        "rect": "Rectangle",
        "ellipse": "Ellipse",
        "circle": "Cercle",
        "line": "Lignes",
        "text": "Texte"
      },
      "errors": {
        "EMPTY": "Dessinez d’abord au moins une annotation",
        "NOT_PDF": "Veuillez téléverser a PDF file",
        "NOT_IMAGE": "Veuillez téléverser an image file",
        "LOAD_FAILED": "Échec : load PDF",
        "NO_PAGES": "Le document n’a pas de pages",
        "INVALID_RANGE": "page range invalide",
        "TOO_LARGE": "Fichier trop volumineux (recommandé < 50 Mo)",
        "ENCRYPT_FAILED": "Échec du chiffrement",
        "PROCESS_FAILED": "Échec du traitement"
      }
    },
    "xsltTransform": {
      "sample": "Charger un exemple",
      "xml": "XML",
      "xmlPlaceholder": "Collez XML…",
      "xslt": "XSLT",
      "xsltPlaceholder": "Collez XSLT stylesheet…",
      "output": "Sortie",
      "preview": "Aperçu HTML",
      "err": {
        "EMPTY_XML": "Veuillez saisir XML",
        "EMPTY_XSLT": "Veuillez saisir XSLT",
        "INVALID_XML": "XML invalide",
        "INVALID_XSLT": "XSLT invalide",
        "TRANSFORM": "Échec de la transformation"
      }
    }
  }
} satisfies TranslationResources;

export default fr;
