import type { TranslationResources } from '../types';

/** Portuguese translation resources */
const pt = {
  "app": {
    "docTitle": "SynTools · Caixa de ferramentas online para programadores"
  },
  "header": {
    "openMenu": "Abrir menu",
    "searchPlaceholder": "Pesquisar ferramentas…",
    "searchAria": "Pesquisar ferramentas",
    "themeAria": "Alternar tema",
    "langAria": "Mudar idioma",
    "sourceAria": "Código-fonte"
  },
  "sidebar": {
    "nav": "Navegação de ferramentas",
    "closeMenu": "Fechar menu",
    "filter": "Filtrar ferramentas",
    "filterPlaceholder": "Filtrar…",
    "filterEmpty": "Nenhuma ferramenta correspondente"
  },
  "home": {
    "title": "Caixa de ferramentas online para programadores",
    "tagline": "Processamento local primeiro; os dados ficam no seu browser (CSP, sem saída) · Prima <1>⌘K</1> ou <3>/</3> para pesquisar",
    "favorites": "Favoritos",
    "recent": "Usados recentemente",
    "favoriteAria": "Adicionar aos favoritos",
    "unfavoriteAria": "Remover dos favoritos"
  },
  "search": {
    "aria": "Pesquisar ferramentas",
    "placeholder": "Pesquisar ferramentas (nome / palavras-chave)…",
    "empty": "Nenhuma ferramenta correspondente encontrada"
  },
  "categories": {
    "encoding": "Codificação",
    "text": "Texto",
    "formatting": "Formatação",
    "crypto": "Criptografia e hash",
    "datetime": "Data e hora",
    "generator": "Geradores",
    "network": "Rede",
    "image": "Imagens",
    "pdf": "PDF",
    "other": "Outros"
  },
  "common": {
    "copy": "Copiar",
    "copied": "Copiado",
    "clear": "Limpar",
    "swap": "Trocar",
    "download": "Transferir",
    "share": "Partilhar",
    "shareTooLong": "Conteúdo demasiado longo (> 2KB); não é possível criar a ligação de partilha",
    "retry": "Tentar novamente",
    "loading": "A carregar",
    "operation": "Ação",
    "encode": "Codificar",
    "decode": "Descodificar",
    "result": "Resultado",
    "rawText": "Texto em bruto",
    "input": "Entrada",
    "output": "Saída",
    "text": "Texto",
    "file": "Ficheiro",
    "remove": "Remover",
    "bytes": "{{size}} bytes"
  },
  "io": {
    "stats": "{{chars}} caracteres / {{bytes}} bytes",
    "warnLarge": "Ingresso de grandi dimensioni (> 500 KB), ou cálculo em tempo real potrebbe rallentare",
    "overflow": "A entrada excede o limite de 5MB; use o modo ficheiro para conteúdo grande"
  },
  "file": {
    "hint": "Arraste e largue um ficheiro aqui, ou clique para escolher",
    "max": "Max {{size}}",
    "over": "O ficheiro excede o limite de {{max}} (atual {{size}})",
    "uploadAria": "Carregar ficheiro",
    "previewAlt": "Pré-visualização de {{name}}",
    "pages": "{{n}} pages",
    "encrypted": "Encriptado"
  },
  "pdf": {
    "password": "Palavra-passe do PDF",
    "passwordPlaceholder": "Introduza a palavra-passe de abertura",
    "passwordHint": "Este PDF está encriptado. Introduza a palavra-passe para continuar.",
    "unlock": "Desbloquear",
    "errors": {
      "NEED_PASSWORD": "Este PDF está encriptado. Introduza a palavra-passe.",
      "WRONG_PASSWORD": "Palavra-passe incorreta. Tente novamente."
    }
  },
  "tool": {
    "errorTitle": "Erro em tempo de execução da ferramenta",
    "localBadge": "Apenas local",
    "serverBadge": "Requer servidor",
    "related": "Ferramentas relacionadas",
    "nextSteps": "Próximos passos",
    "openIn": "Abrir em {{name}}",
    "progress": "Progresso {{current}} / {{total}}"
  },
  "notFound": {
    "message": "Página ou ferramenta não encontrada",
    "back": "Voltar ao início"
  },
  "toolsMeta": {
    "base64": {
      "name": "Codificar / descodificar Base64",
      "description": "Converte texto e Base64 com codificação Unicode segura; suporta URL Safe e modo ficheiro"
    },
    "url-codec": {
      "name": "Codificar / descodificar URL",
      "description": "Modos encodeURIComponent / encodeURI com deteção de codificação percentual malformada"
    },
    "regex-tester": {
      "name": "Ferramenta Regex",
      "description": "Realce de correspondências, substituição, grupos de captura, predefinições e folha de consulta"
    },
    "text-diff": {
      "name": "Diff de texto",
      "description": "Editores lado a lado com realce em linha, números de linha e ignorar espaços"
    },
    "json-format": {
      "name": "Formatador JSON",
      "description": "Formata / minifica / valida com indentação de 2/4 espaços e erros linha/coluna"
    },
    "json-convert": {
      "name": "Conversor JSON",
      "description": "Analisa JSON e converte-o para YAML / XML / CSV"
    },
    "timestamp": {
      "name": "Conversor de timestamp",
      "description": "Unix ⇄ hora legível com deteção auto de segundos/ms e relógio em direto"
    },
    "uuid": {
      "name": "Gerador UUID",
      "description": "UUID v4 aleatórios / v7 ordenados por tempo com saída em lote e opções de formatação"
    },
    "hash": {
      "name": "Calculadora de hash",
      "description": "MD5 / SHA-1 / SHA-256 / SHA-512 para texto e ficheiros (streaming), saída hex / base64"
    },
    "jwt-parser": {
      "name": "Analisador JWT",
      "description": "Analisa header / payload / signature e lê exp e outras claims de tempo (só leitura, sem verificar)"
    },
    "aes-crypto": {
      "name": "Encriptar / desencriptar AES",
      "description": "AES-GCM com frase-passe PBKDF2 ou chave em bruto; saída base64(salt|iv|ciphertext)"
    },
    "hmac": {
      "name": "HMAC",
      "description": "HMAC-SHA256 / SHA512 com saída hex / base64"
    },
    "totp": {
      "name": "TOTP",
      "description": "TOTP RFC 6238: gerar / verificar, 6/8 dígitos, segundos restantes"
    },
    "x509-decode": {
      "name": "Descodificador de certificados X.509",
      "description": "Analisa PEM: impressões SHA-256/SHA-1, tipo, comprimento DER, CN"
    },
    "cidr-calc": {
      "name": "Calculadora CIDR",
      "description": "CIDR IPv4: rede / broadcast / intervalo de hosts / máscara / nº de hosts"
    },
    "text-lines": {
      "name": "Ferramentas de linhas de texto",
      "description": "Ordenar / únicos / inverter / numerar / remover linhas vazias"
    },
    "hex-codec": {
      "name": "Codificar / descodificar hex",
      "description": "Hex ↔ texto UTF-8 com espaços opcionais"
    },
    "url-query": {
      "name": "Analisador de consulta URL",
      "description": "Analisa partes da URL e parâmetros de consulta; reconstrói após editar"
    },
    "json-path": {
      "name": "Consulta JSONPath",
      "description": "Consultas de caminho simples como a.b[0].c"
    },
    "gzip-tool": {
      "name": "Compressão Gzip",
      "description": "Comprime texto para base64 com Gzip / descomprime de volta para texto"
    },
    "exif-strip": {
      "name": "Remover EXIF",
      "description": "Lê EXIF JPEG básico e remove APP1; transfira o ficheiro limpo"
    },
    "fake-data": {
      "name": "Gerador de dados falsos",
      "description": "Gera nomes / emails / UUID / lorem em zh/en, 1–50 itens"
    },
    "password-gen": {
      "name": "Gerador de palavras-passe",
      "description": "Palavras-passe aleatórias fortes com opções de comprimento / charset, estimativa de entropia e nível"
    },
    "entity-codec": {
      "name": "Codificar / descodificar HTML",
      "description": "Codifica/descodifica caracteres especiais HTML: com nome / decimal / hex / escapes \\u"
    },
    "cron-parser": {
      "name": "Analisador de expressões Cron",
      "description": "Valida expressões cron, explica campos e pré-visualiza próximas execuções"
    },
    "convert-data": {
      "name": "Conversor de formatos de dados de configuração",
      "description": "Converte YAML ⇄ JSON ⇄ TOML através de um valor JS intermédio sem perda"
    },
    "sql-format": {
      "name": "Formatador SQL",
      "description": "Embeleza SQL em vários dialetos com indentação e maiúsculas de palavras-chave configuráveis"
    },
    "html-format": {
      "name": "Minificar / embelezar HTML",
      "description": "Minifica e embeleza HTML com indentação de 2/4 espaços"
    },
    "js-format": {
      "name": "Minificar / embelezar JS",
      "description": "Minifica e embeleza JavaScript com indentação de 2/4 espaços"
    },
    "css-format": {
      "name": "Minificar / embelezar CSS",
      "description": "Minifica e embeleza CSS com indentação de 2/4 espaços"
    },
    "xml-format": {
      "name": "Minificar / embelezar XML",
      "description": "Embeleza e minifica XML com indentação de 2/4 espaços; CDATA preservado"
    },
    "xml-json": {
      "name": "XML para JSON",
      "description": "Analisa XML para JSON, mantendo atributos com o prefixo @_"
    },
    "qrcode": {
      "name": "Código QR",
      "description": "Gera e descodifica códigos QR com ECC, tamanho, cores e margem"
    },
    "color-converter": {
      "name": "Conversor de cores",
      "description": "Converte e pré-visualiza formatos HEX / RGB / HSL"
    },
    "radix-converter": {
      "name": "Conversor de bases",
      "description": "Converte bases 2/8/10/16 e visualiza operações bit a bit para inteiros com sinal de 64 bits"
    },
    "markdown-preview": {
      "name": "Pré-visualização Markdown",
      "description": "Renderização GFM em direto com sanitização DOMPurify para pré-visualização segura"
    },
    "image-compress": {
      "name": "Comprimir imagem",
      "description": "Compressão e conversão de imagem no cliente (PNG / JPEG / WebP) com redimensionamento e qualidade"
    },
    "unicode-codec": {
      "name": "Codec Unicode",
      "description": "Converte texto para/de \\uXXXX, pontos de código, entidades HTML e bytes UTF-8"
    },
    "html-color-picker": {
      "name": "Seletor de cor HTML",
      "description": "Escolha cores visualmente e exporte HEX / RGB / HSL mais excertos HTML/CSS"
    },
    "web-color-table": {
      "name": "Tabela de cores web",
      "description": "Cores com nome CSS com filtros por grupo e cópia de nome / HEX / RGB"
    },
    "pinyin": {
      "name": "Chinês para pinyin",
      "description": "Converte chinês para pinyin com tons, separador e maiúsculas opcionais"
    },
    "length-converter": {
      "name": "Conversor de comprimento",
      "description": "Converte unidades de comprimento métricas e imperiais (mm, cm, m, km, in, ft e mais)"
    },
    "zh-convert": {
      "name": "Conversor de chinês tradicional",
      "description": "Converte entre chinês simplificado e tradicional"
    },
    "weight-converter": {
      "name": "Conversor de peso",
      "description": "Converte unidades de peso métricas e imperiais (mg, g, kg, t, oz, lb, st)"
    },
    "text-counter": {
      "name": "Contador de texto",
      "description": "Conta caracteres, palavras, linhas, parágrafos, caracteres CJK e bytes UTF-8"
    },
    "calendar": {
      "name": "Calendário",
      "description": "Vista mensal com lunar/almanaque para chinês e feriados locais para inglês"
    },
    "css-button": {
      "name": "Gerador de botões CSS",
      "description": "Ajuste estilos visualmente e gere CSS / HTML de botões"
    },
    "random-number": {
      "name": "Gerador de números aleatórios",
      "description": "Gera inteiros ou decimais aleatórios num intervalo, com valores únicos opcionais"
    },
    "random-string": {
      "name": "Gerador de cadeias aleatórias",
      "description": "Gera cadeias aleatórias por comprimento e charset (alnum / hex / personalizado)"
    },
    "doodle-board": {
      "name": "Quadro de desenho",
      "description": "Bloco de desenho no browser com pincel, borracha e exportação PNG"
    },
    "calculator": {
      "name": "Calculadora",
      "description": "Calculadora de expressões segura com aritmética, potências, módulo e funções comuns"
    },
    "code-image": {
      "name": "Código para imagem",
      "description": "Renderiza código como cartão com realce de sintaxe e exporta PNG"
    },
    "image-color-picker": {
      "name": "Seletor de cor de imagem",
      "description": "Carregue uma imagem e clique num píxel para amostrar HEX / RGB"
    },
    "ascii-table": {
      "name": "Tabela ASCII",
      "description": "Referência ASCII 0–127 com pesquisa por decimal, hex ou carácter"
    },
    "image-watermark": {
      "name": "Marca de água em imagem",
      "description": "Adicione uma marca de água de texto com posição, opacidade, rotação e mosaico"
    },
    "case-convert": {
      "name": "Conversor de maiúsculas/minúsculas",
      "description": "Converte maiúsculas/minúsculas e estilos de nomes (camel / snake / kebab, etc.)"
    },
    "bmi-calculator": {
      "name": "Calculadora de IMC",
      "description": "Calcula o IMC a partir da altura e do peso com categorias WHO para adultos"
    },
    "placeholder-image": {
      "name": "Imagem de marcador de posição",
      "description": "Gera um PNG de marcador de posição por tamanho, cores e texto opcional"
    },
    "image-merge": {
      "name": "Unir imagens",
      "description": "Une imagens na horizontal, vertical ou grelha num PNG"
    },
    "cron-generator": {
      "name": "Gerador de Crontab",
      "description": "Constrói uma expressão Cron padrão de 5 campos a partir de minuto/hora/dia/mês/dia da semana"
    },
    "ua-parser": {
      "name": "Analisador User-Agent",
      "description": "Analisa um User-Agent do browser em browser, motor, SO e dispositivo"
    },
    "latex-editor": {
      "name": "Editor de matemática LaTeX",
      "description": "Símbolos rápidos e fórmulas clássicas, pré-visualização KaTeX, exportar PNG/JPG/SVG"
    },
    "countdown": {
      "name": "Temporizador de contagem decrescente",
      "description": "Defina horas, minutos e segundos; pause, retome e alerta ao terminar"
    },
    "stopwatch": {
      "name": "Cronómetro",
      "description": "Cronómetro online com início, pausa, volta e reposição"
    },
    "svg-to-png": {
      "name": "SVG para PNG",
      "description": "Converte marcação ou ficheiros SVG para PNG com escala e transparência"
    },
    "image-frame": {
      "name": "Margem / raio / sombra de imagem",
      "description": "Adicione margem, cantos arredondados e sombra, depois exporte PNG"
    },
    "image-adjust": {
      "name": "Ajuste de cor de imagem",
      "description": "Ajuste brilho, contraste, saturação e matiz, depois exporte PNG"
    },
    "gif-frames": {
      "name": "Extrator de fotogramas GIF",
      "description": "Divide um GIF em fotogramas PNG; transfira um ou todos"
    },
    "image-crop": {
      "name": "Recortar imagem",
      "description": "Recorta imagens à mão livre ou com proporções fixas para PNG"
    },
    "mbti-test": {
      "name": "Teste de personalidade MBTI",
      "description": "Um questionário curto estilo MBTI de 24 perguntas (apenas entretenimento)"
    },
    "text-card": {
      "name": "Texto para cartão",
      "description": "Layout de título e corpo num cartão com estilo e exportação PNG"
    },
    "image-card": {
      "name": "Imagem para cartão",
      "description": "Cartão foto + título/subtítulo com fundos ou gradientes, exportar PNG"
    },
    "code-highlight": {
      "name": "Realçador de código",
      "description": "Realce de sintaxe em direto com números de linha e cópia de excerto HTML"
    },
    "image-base64": {
      "name": "Imagem ↔ Base64",
      "description": "Converte imagens para Base64 / Data URL e vice-versa, totalmente em local"
    },
    "image-ico": {
      "name": "Conversor ICO",
      "description": "Converte imagens para ICO multi-tamanho (favicon), ou extrai PNG de ICO"
    },
    "hsv-cmyk": {
      "name": "Conversor HSV / CMYK",
      "description": "Converte e pré-visualiza espaços RGB, HSV, CMYK e HEX"
    },
    "ai-prompts": {
      "name": "Biblioteca de prompts de IA",
      "description": "Prompts selecionados por categoria com pesquisa e cópia com um clique"
    },
    "md-mindmap": {
      "name": "Mapa mental Markdown",
      "description": "Converte Markdown num mapa mental com temas, zoom e exportação PNG/SVG"
    },
    "mermaid-editor": {
      "name": "Editor de diagramas Mermaid",
      "description": "Renderiza Mermaid em local com temas, zoom e exportação PNG/SVG"
    },
    "css-gradient": {
      "name": "Gerador de gradientes CSS",
      "description": "Edite gradientes lineares / radiais com predefinições categorizadas e copie CSS"
    },
    "image-to-paper": {
      "name": "Imagem para PDF de papel",
      "description": "Ajusta imagens a A3/A4/A5/Letter e exporta PDF"
    },
    "md-to-image": {
      "name": "Markdown para imagem",
      "description": "Renderiza Markdown num cartão com estilo e exporta PNG com tipo de letra, tamanho, largura e cores"
    },
    "chart-generator": {
      "name": "Gerador de gráficos",
      "description": "Cria gráficos de barras/linhas/áreas/circular/anel/dispersão a partir de CSV com legendas e paletas"
    },
    "css3-generator": {
      "name": "Gerador de código CSS3",
      "description": "Gera border-radius, sombras, transform, filter e mais"
    },
    "xslt-transform": {
      "name": "Transformação XSLT",
      "description": "Transforma XML para HTML com XSLT no browser"
    },
    "pdf-merge": {
      "name": "Unir PDF",
      "description": "Une vários PDF num único ficheiro"
    },
    "pdf-split": {
      "name": "Dividir PDF",
      "description": "Divide um PDF num ficheiro por página"
    },
    "pdf-delete-pages": {
      "name": "Eliminar páginas PDF",
      "description": "Remove as páginas selecionadas de um PDF"
    },
    "pdf-extract-pages": {
      "name": "Extrair páginas PDF",
      "description": "Extrai as páginas selecionadas para um novo PDF"
    },
    "pdf-reorder": {
      "name": "Reordenar páginas PDF",
      "description": "Reordena as páginas de um PDF"
    },
    "pdf-rotate": {
      "name": "Rodar páginas PDF",
      "description": "Roda as páginas selecionadas ou todas"
    },
    "pdf-to-image": {
      "name": "PDF para imagem",
      "description": "Renderiza páginas PDF como JPG/PNG"
    },
    "images-to-pdf": {
      "name": "Imagens para PDF",
      "description": "Combina imagens num PDF"
    },
    "pdf-viewer": {
      "name": "Visualizador PDF",
      "description": "Abre e lê um PDF em local"
    },
    "pdf-page-numbers": {
      "name": "Números de página PDF",
      "description": "Adiciona números de página a um PDF"
    },
    "pdf-header-footer": {
      "name": "Cabeçalho e rodapé PDF",
      "description": "Adiciona texto de cabeçalho e rodapé"
    },
    "pdf-insert-image": {
      "name": "Inserir imagem no PDF",
      "description": "Coloca uma imagem nas páginas do PDF"
    },
    "pdf-add-text": {
      "name": "Adicionar texto ao PDF",
      "description": "Adiciona texto nas páginas do PDF"
    },
    "pdf-sign": {
      "name": "Assinar PDF",
      "description": "Desenhe ou carregue uma imagem de assinatura (visual, não certificado)"
    },
    "pdf-metadata": {
      "name": "Metadados PDF",
      "description": "Ver e editar metadados PDF"
    },
    "pdf-encrypt": {
      "name": "Encriptar PDF",
      "description": "Defina palavra-passe e flags de permissões"
    },
    "pdf-crop": {
      "name": "Recortar PDF",
      "description": "Recorta margens de página via cropBox"
    },
    "pdf-grayscale": {
      "name": "PDF em escala de cinzentos",
      "description": "Converte PDF para escala de cinzentos visual"
    },
    "pdf-annotate": {
      "name": "Anotar PDF",
      "description": "Desenhe realces, à mão livre, formas e texto em páginas PDF"
    }
  },
  "tools": {
    "base64": {
      "direction": {
        "encode": "Codificar (texto → Base64)",
        "decode": "Descodificar (Base64 → texto)"
      },
      "urlSafe": "URL Seguro (- _ sem imbottitura)",
      "labels": {
        "rawText": "Texto em bruto",
        "base64Input": "Entrada Base64",
        "base64Result": "Resultado Base64",
        "decodeResult": "Resultado descodificado"
      },
      "placeholders": {
        "encode": "Introduza texto para codificar…",
        "decode": "Paste a Base64 string…"
      },
      "fileNote": "A mostrar um resultado Base64 de ficheiro; ao escrever texto será limpo.",
      "fileMode": "Modo ficheiro: ficheiro → Base64 (fragmentos ArrayBuffer)",
      "err": {
        "INVALID_PADDING": "Padding inválido \"=\" em posição {{position}}",
        "INVALID_CHAR": "Carácter \" {{char}} \" inválido na posição {{position}}",
        "INVALID_LENGTH": "Invalid length: Base64 content length mod 4 cannot be 1",
        "DECODE_FAILED": "Falha ao descodificar: entrada Base64 inválida"
      }
    },
    "url": {
      "modes": {
        "component": "componente (valor de parâmetro; codifica caracteres reservados)",
        "full": "URL completa (mantém : / ? & etc.)"
      },
      "mode": "Mode",
      "labels": {
        "rawText": "Texto em bruto",
        "encodedText": "Texto codificado"
      },
      "placeholders": {
        "encode": "Introduza conteúdo para codificar…",
        "decode": "Colar conteúdo codificado em percentuale..."
      },
      "err": {
        "ENCODE_FAILED": "Falha ao codificar: a entrada contém caracteres substitutos sem par",
        "DECODE_FAILED": "Falha ao descodificar: codificação percentual malformada"
      }
    },
    "regex": {
      "presets": "Preimpostações",
      "presetPlaceholder": "Escolha o que preencher…",
      "expression": "Pattern",
      "expressionPlaceholder": "e.g. \\d+",
      "flags": "Flag",
      "testText": "Texto de prova",
      "testTextPlaceholder": "Colar ou texto para abbinarlo...",
      "matchCount": "{{count}} match(es)",
      "truncated": " (truncado; a mostrar os primeiros 1000)",
      "position": "Indice",
      "matchContent": "Match",
      "captureGroups": "Grupos",
      "emptyMatch": "(correspondência vazia)",
      "tableLimit": "Showing first {{count}} rows only",
      "mode": "Mode",
      "modes": {
        "match": "Match",
        "replace": "Substituir"
      },
      "replacement": "Substituir com",
      "replacementPlaceholder": "Supporta $1, $&,...",
      "replaceResult": "Substituir resultado",
      "cheatSheet": "Folha de consulta (clique para inserir)",
      "cheat": {
        "dot": "Qualquer carácter",
        "digit": "Dígito",
        "word": "Word char",
        "space": "Whitespace",
        "start": "Inizio linha",
        "end": "Fim de linha",
        "star": "0 ou mais",
        "plus": "1 ou mais",
        "question": "0 ou 1",
        "or": "Alternância",
        "group": "Grupo de captura",
        "class": "Classe de caracteres",
        "range": "Range",
        "not": "Classe negata"
      },
      "presetsList": {
        "email": "Email",
        "phoneCn": "Telefono (Cina continentale)",
        "idCard": "Carta d'identidade (18 cifre)",
        "url": "URL",
        "ipv4": "Endereço 0",
        "date": "Data (yyyy-mm-dd)"
      },
      "err": {
        "EMPTY": "L'expressão regular não pode essere vuota",
        "COMPILE": "Falha de compilação: {{message}}",
        "TEXT_TOO_LONG": "O texto excede o limite de {{limit}}K caracteres; a correspondência parou (proteção ReDoS / execução longa)"
      }
    },
    "textDiff": {
      "oldText": "Originale",
      "newText": "Revisionato",
      "swapSides": "Inverti lati",
      "stats": "+{{added}} adicionados / −{{removed}} removidos / {{same}} inalterados",
      "identical": "Ambos os textos são idênticos",
      "renderLimit": "Too many diff rows; rendering first {{count}} only",
      "ignoreWhitespace": "Ignora espaços finali / ripetuti",
      "err": {
        "TOO_LARGE": "O texto combinado excede o limite de {{limit}}K caracteres; o diff parou (proteção de execução longa)"
      }
    },
    "json": {
      "actions": {
        "format": "Format",
        "compress": "Minify",
        "validate": "Solo convalida"
      },
      "indent": "Rientro",
      "indent2": "2 espaços",
      "indent4": "4 espaços",
      "inputLabel": "Ingresso 0",
      "validateResult": "Resultado convalida",
      "inputPlaceholder": "Colar JSON, p. ex. {\"a\": 1}...",
      "valid": "✓ Válido JSON",
      "err": {
        "EMPTY": "JSON analisi não bem-sucedida: ou input é vazio",
        "UNKNOWN": "JSON analisi não bem-sucedida: erro sconosciuto",
        "INVALID_LITERAL": "JSON analisi não bem-sucedida: letterale previsto \" {{literal}} \" (linha {{line}} , coluna {{column}} )",
        "NEWLINE_IN_STRING": "Falha ao analisar JSON: a cadeia não pode abranger linhas (linha {{line}}, coluna {{column}})",
        "UNEXPECTED_STRING_END": "JSON analisi não bem-sucedida: stringa terminata inaspettatamente (linha {{line}} , coluna {{column}} )",
        "INVALID_UNICODE_ESCAPE": "JSON analisi não bem-sucedida: escape inválido \\u, são necessarie 4 cifre esadecimali (linha {{line}} , coluna {{column}} )",
        "INVALID_ESCAPE": "JSON analisi não bem-sucedida: escape inválido \"\\ {{char}} \" (linha {{line}} , coluna {{column}} )",
        "INVALID_NUMBER": "JSON analisi não bem-sucedida: número inválido (linha {{line}} , coluna {{column}} )",
        "DECIMAL_NO_DIGITS": "JSON analisi não bem-sucedida: cifre richieste depois a virgola decimale (linha {{line}} , coluna {{column}} )",
        "EXPONENT_NO_DIGITS": "JSON analisi não bem-sucedida: cifre richieste nell'esponente (linha {{line}} , coluna {{column}} )",
        "UNEXPECTED_END": "JSON analisi não bem-sucedida: fine imprevista, valor mancante (linha {{line}} , coluna {{column}} )",
        "INVALID_CHAR": "JSON analisi não bem-sucedida: carácter \" {{char}} \" inválido (linha {{line}} , coluna {{column}} )",
        "TRAILING_COMMA": "JSON analisi não bem-sucedida: virgola finale não consentita (linha {{line}} , coluna {{column}} )",
        "KEY_MUST_BE_STRING": "JSON analisi não bem-sucedida: a chave dell'oggetto deve ser uma stringa (linha {{line}} , coluna {{column}} )",
        "MISSING_COLON": "JSON analisi não bem-sucedida: manca \":\" depois a chave dell'oggetto (linha {{line}} , coluna {{column}} )",
        "MISSING_VALUE": "JSON analisi não bem-sucedida: valor mancante (linha {{line}} , coluna {{column}} )",
        "UNCLOSED_OBJECT": "JSON analisi não bem-sucedida: oggetto não chiuso, \"}\" mancante (linha {{line}} , coluna {{column}} )",
        "MISSING_COMMA_OBJECT": "JSON analisi não bem-sucedida: manca \",\" entre os membri dell'oggetto (linha {{line}} , coluna {{column}} )",
        "UNCLOSED_ARRAY": "JSON analisi não bem-sucedida: matrice não chiusa, manca \"]\" (linha {{line}} , coluna {{column}} )",
        "MISSING_COMMA_ARRAY": "JSON analisi não bem-sucedida: manca \",\" entre os elementi dell'array (linha {{line}} , coluna {{column}} )",
        "EXTRA_CONTENT": "JSON analisi não bem-sucedida: conteúdo extra depois ou valor (linha {{line}} , coluna {{column}} )",
        "UNCLOSED_STRING": "JSON analisi não bem-sucedida: stringa não chiusa (linha {{line}} , coluna {{column}} )"
      }
    },
    "timestamp": {
      "currentTime": "Hora atual",
      "pauseTick": "Metti em pausa ou orologio",
      "resumeTick": "Riattiva orologio",
      "second": "Secondi",
      "millisecond": "Millisecondi",
      "localPrefix": "Local: {{local}} · {{utc}}",
      "tsToReadable": "Timestamp tempo → leggibile (deteção automatico segundos / ms)",
      "fillCurrentSec": "Preencher atual (segundos)",
      "tsInput": "Inserimento marca temporale",
      "tsPlaceholder": "e.g. 1725000000 or 1725000000000",
      "localTime": "Hora local",
      "relative": "Relativo (detetado como {{unit}} )",
      "unitSeconds": "seconds",
      "unitMilliseconds": "milliseconds",
      "dateToTs": "→ Timestamp leggibile (ou spazio separato utilizza ou fuso horário local)",
      "dateInput": "Entrada de data/hora",
      "datePlaceholder": "e.g. 2026-09-01 12:00:00 or 2026-09-01T04:00:00Z",
      "relativeAgo": "{{count}} {{unit}} ago",
      "relativeLater": "{{count}} {{unit}} from now",
      "units": {
        "second": "seconds",
        "minute": "minutes",
        "hour": "hours",
        "day": "days",
        "year": "years"
      },
      "err": {
        "NOT_NUMERIC": "O timestamp deve ser numérico (negativos permitidos)",
        "OUT_OF_RANGE": "Timestamp fora dall'intervallo numerico",
        "TS_TOO_LARGE": "Timestamp fora intervallo rappresentabile (±275760 anni)",
        "DATE_EMPTY": "Introduza uma data",
        "DATE_INVALID": "Não é possível analisar data/hora (p. ex. 2026-09-01 12:00:00 ou ISO 8601)"
      }
    },
    "uuid": {
      "version": "Version",
      "versions": {
        "v4": "v4 (random)",
        "v7": "v7 (time-ordered)"
      },
      "count": "Quantidade",
      "uppercase": "Uppercase",
      "hyphens": "Sillabações",
      "braces": "Chavetas",
      "generate": "Gerar",
      "output": "Gerado (um por linha)",
      "err": {
        "INVALID_COUNT": "A quantidade deve ser um inteiro ≥ 1",
        "TOO_MANY": "Máximo {{max}} UUID para lotto"
      }
    },
    "hash": {
      "algorithm": "Algoritmo",
      "encoding": "Saída",
      "encodings": {
        "hex": "hex (hexadecimal)",
        "base64": "base64"
      },
      "source": "Source",
      "textInput": "Input de texto",
      "textPlaceholder": "Introduza texto para calcular o hash…",
      "result": "{{algorithm}} result",
      "computing": "A calcular…",
      "fileHint": "Arraste e largue um ficheiro aqui, ou clique para escolher (MD5 em streaming; ficheiros grandes seguros em memória)",
      "limitHint": "Nota: algoritmos que não sejam MD5 carregam o ficheiro inteiro na memória; ficheiros muito grandes podem esgotar a memória",
      "err": {
        "UNSUPPORTED": "Falha de hash: algoritmo não suportado neste ambiente",
        "FILE_HASH": "Falha de hash do ficheiro: {{message}}",
        "FILE_READ": "Falha ao ler o conteúdo do ficheiro"
      }
    },
    "jwt": {
      "mode": "Mode",
      "modes": {
        "parse": "Analizza",
        "sign": "Cartello (HS256)"
      },
      "secretPlaceholder": "Segredo HMAC…",
      "payloadJson": "Carico utile",
      "payloadPlaceholder": "{ \"sub\": \"123\", \"name\": \"Alice\" }",
      "signedToken": "Token assinado",
      "signNote": "Segni com HS256 no browser; ou segredo não lascia mai ou dispositivo",
      "inputLabel": "Ingresso 0",
      "inputPlaceholder": "Colar um JWT (prefixo do portatore suportado), p. ex. eyJhbGci...",
      "header": "Header",
      "payload": "Carico utile",
      "signature": "Signature",
      "note": "Solo analisi, nenhuma verifica de assinatura: a verifica richiede uma chave; todas as elaborações rimangono no browser",
      "alg": "Algoritmo",
      "expired": "Expirado",
      "notExpired": "Non expirado",
      "claims": {
        "exp": "Expiração exp",
        "nbf": "Non antes",
        "iat": "Emesso a"
      },
      "err": {
        "EMPTY": "Incollare um JWT",
        "INVALID_PARTS": "Formato inválido: um JWT é costituito de header.payload.signature",
        "INVALID_HEADER": "Falha ao analisar o cabeçalho: JSON em base64url inválido",
        "INVALID_PAYLOAD": "Falha ao analisar o payload: JSON em base64url inválido",
        "SIGN_FAILED": "Assinatura não bem-sucedida"
      }
    },
    "aes-crypto": {
      "encrypt": "Encriptar",
      "decrypt": "Desencriptar",
      "keyMode": "Modalidade chave",
      "passphrase": "Passphrase (PBKDF2)",
      "rawKey": "Chave grezza (esadecimale)",
      "passphrasePlaceholder": "Introduza a frase-passe…",
      "keyHexPlaceholder": "32 ou 64 caracteres hex (AES-128/256)…",
      "ivPlaceholder": "Facoltativo IV (24 caracteres esadecimali/ 12 byte); casuale se vazio",
      "plaintext": "Plaintext",
      "ciphertext": "Texto cifrado (base64)",
      "inputPlaceholder": "Introduza conteúdo…",
      "note": "Saída encriptada: base64(salt|iv|ciphertext+tag); a frase-passe usa PBKDF2-SHA256",
      "err": {
        "EMPTY": "Introduza ou conteúdo",
        "INVALID_KEY": "Chave inválida: controlla a passphrase ou a lunghezza de chave esadecimale",
        "DECRYPT_FAILED": "Falha ao desencriptar: chave incorreta ou dados corrompidos",
        "INVALID_INPUT": "Input inválido: texto cifrato errato ou IV"
      }
    },
    "hmac": {
      "algorithm": "Algoritmo",
      "encoding": "Saída",
      "secretPlaceholder": "Segredo HMAC…",
      "message": "Messagem",
      "messagePlaceholder": "Messagem de autenticare...",
      "err": {
        "EMPTY": "Introduza um mensagem",
        "INVALID_KEY": "Inserire um codice válido"
      }
    },
    "totp": {
      "digits": "Dígitos",
      "secret": "Segredo Base32",
      "secretPlaceholder": "Colar Authenticator secret (Base32)...",
      "code": "Código atual",
      "remaining": "segundos rimasti",
      "verify": "Codice de verifica (facoltativo)",
      "verifyPlaceholder": "Introduza um código de 6/8 dígitos…",
      "verifyOk": "Verifica effettuata",
      "verifyFail": "Verifica não bem-sucedida",
      "err": {
        "EMPTY": "Introduza a chave segreta",
        "INVALID_SECRET": "O segredo não é Base32 válido"
      }
    },
    "cidr-calc": {
      "input": "CIDR",
      "placeholder": "e.g. 192.168.1.0/24",
      "fields": {
        "network": "Rede",
        "broadcast": "Broadcast",
        "firstHost": "Primeiro host",
        "lastHost": "Ultimo host",
        "netmask": "子网掩码",
        "wildcard": "Wildcard",
        "prefix": "Prefisso",
        "hostCount": "Conteggio dos host",
        "totalAddresses": "Total indirizzi IP"
      },
      "err": {
        "EMPTY": "Per favore introduza um",
        "INVALID": "CIDR (IPv4/prefixo inválido, p. ex. 10.0.0.0/8)"
      }
    },
    "text-lines": {
      "placeholder": "Un articolo por linha...",
      "ops": {
        "sort-asc": "Crescente",
        "sort-desc": "Decrescente",
        "unique": "Único",
        "reverse": "Reverse",
        "number": "Numero linhas",
        "trim-empty": "Taglia linhas vuote"
      },
      "err": {
        "EMPTY": "Si prega de inserire ou texto"
      }
    },
    "hex-codec": {
      "spaced": "Byte separati de espaços",
      "placeholder": "Texto ou esadecimale...",
      "err": {
        "EMPTY": "Introduza ou conteúdo",
        "INVALID_HEX": "Hex inválido (lunghezza pari, 0-9a-f)"
      }
    },
    "url-query": {
      "input": "URL",
      "placeholder": "https://example.com/path?a=1&b=2",
      "addParam": "Adicionar parâmetro",
      "key": "Key",
      "value": "Valore",
      "rebuilt": "Ricostruito",
      "parts": {
        "protocol": "Protocollo",
        "hostname": "Host",
        "port": "Port",
        "pathname": "Path",
        "hash": "Hash",
        "origin": "Provenienza"
      },
      "err": {
        "EMPTY": "Per favore introduza um",
        "INVALID_URL": "{0} inválido.&#x0D;"
      }
    },
    "json-path": {
      "pathPlaceholder": "Percorso, p. ex. a.b[0].c ou $.a.b[0]",
      "json": "JSON",
      "jsonPlaceholder": "Colar",
      "err": {
        "EMPTY": "Introduza JSON e um caminho",
        "INVALID_JSON": "Parse falhado!",
        "NOT_FOUND": "Impossibile trovare ou caminho"
      }
    },
    "gzip-tool": {
      "compress": "Comprimir (texto → base64)",
      "decompress": "Descomprimir (base64 → texto)",
      "placeholder": "Texto ou gzip base64...",
      "err": {
        "EMPTY": "Introduza ou conteúdo",
        "INVALID": "Input inválido",
        "DECOMPRESS_FAILED": "Falha ao descomprimir: dados gzip inválidos"
      }
    },
    "x509-decode": {
      "input": "Certificado PEM",
      "placeholder": "-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----",
      "fields": {
        "pemType": "Type",
        "derLength": "Comprimento DER",
        "sha256": "SHA-256",
        "sha1": "SHA-1",
        "subject": "Soggetto CN",
        "issuer": "CN emittente"
      },
      "err": {
        "EMPTY": "Si prega de incollare PEM",
        "INVALID_PEM": "PEM inválido"
      }
    },
    "exif-strip": {
      "hint": "JPEG only: strip APP1 (EXIF) and download.",
      "drop": "Largue uma imagem JPEG",
      "hasExif": "Tem EXIF",
      "orientation": "Orientamento",
      "make": "Marca da câmara",
      "yes": "Yes",
      "no": "No",
      "download": "Transferir ficheiro limpo",
      "err": {
        "EMPTY": "Per favore escolha um ficheiro",
        "UNSUPPORTED": "apenas 0",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "fake-data": {
      "kind": "Kind",
      "locale": "Impostações locali",
      "count": "Quantidade",
      "generate": "Gerar",
      "kinds": {
        "name": "Name",
        "email": "Email",
        "uuid": "UUID",
        "lorem": "Paragrafo"
      },
      "err": {
        "EMPTY": "Completa as opções",
        "INVALID_COUNT": "A quantidade deve ser um inteiro de 1 a 50"
      }
    },
    "password": {
      "length": "Lung.",
      "generate": "Gerar",
      "lowercase": "Minuscole (a-z)",
      "uppercase": "Lettere maiúsculas de A à Z",
      "digits": "Dígitos (0-9)",
      "symbols": "Simbologia",
      "excludeAmbiguous": "Excluir caracteres ambíguos (0 O 1 l I etc.)",
      "ensureEach": "Includi almeno um carácter de ciascun set selezionato",
      "output": "Resultado",
      "outputPlaceholder": "Clique em «Gerar» para criar uma palavra-passe",
      "entropy": "Entropia ≈ {{bits}} bits",
      "strength": {
        "weak": "Weak",
        "medium": "Medio",
        "strong": "Strong"
      },
      "err": {
        "NO_SETS": "Selecionar almeno um set de caracteres",
        "INVALID_LENGTH": "O comprimento deve ser compresa entre 4 e 128"
      }
    },
    "entity": {
      "direction": "Direção",
      "encode": "Codificar",
      "decode": "Descodificar",
      "mode": "Format",
      "modes": {
        "named": "Con nome (&amp;)",
        "decimal": "Decimal (&)",
        "hex": "Esagonale (&)",
        "unicode": "\\u escape (\\u4E2D)"
      },
      "scope": "Scope",
      "scopes": {
        "special": "Solo caracteres speciali (&, <, > ecc.)",
        "nonascii": "Caracteres speciali + não ASCII"
      },
      "input": "Entrada",
      "output": "Saída",
      "inputEncodePlaceholder": "Texto de codificare, p. ex. <b>Ciao</b>...",
      "inputDecodePlaceholder": "Texto de decodificare, p. ex. &lt;b&gt;&#20320;&#22909;...",
      "unknown": "Entidade não riconosciute (mantenute così como são)"
    },
    "cron": {
      "expression": "Expressão",
      "placeholder": "e.g. */5 8-18 * * 1-5 or @daily (5 fields, 6 with seconds)",
      "count": "Quantidade",
      "normalized": "Normalizzato",
      "fieldsTitle": "Discriminação de campos",
      "colField": "Campo",
      "colValue": "Valore",
      "colMeaning": "Significato",
      "nextTitle": "Prossime {{count}} corse",
      "fieldNames": {
        "second": "Segundo",
        "minute": "Minuto",
        "hour": "Hour",
        "day": "Day",
        "month": "Mês",
        "week": "Dia lavorativo"
      },
      "err": {
        "EMPTY": "Introduza um'expressão cron",
        "INVALID": "Não é possível analisar: verifique o nº de campos (5 ou 6) e os intervalos (min 0-59 / hora 0-23 / dia 1-31 / mês 1-12 / dia sem. 0-7)"
      },
      "desc": {
        "every": {
          "second": "cada attimo,",
          "minute": "cada minuto",
          "hour": "cada agora",
          "day": "cada dia",
          "month": "cada mese",
          "week": "cada dia de settimana"
        },
        "step": "cada {{n}} {{unit}}",
        "at": "{{noun}}{{values}}",
        "range": "{{noun}}{{a}}–{{b}}",
        "rangeStep": "{{noun}}{{a}}–{{b}}, every {{n}}",
        "units": {
          "second": "seconds",
          "minute": "minutes",
          "hour": "hours",
          "day": "days",
          "month": "months",
          "week": "days"
        },
        "nouns": {
          "second": "secondo",
          "minute": "minuto",
          "hour": "agora",
          "day": "day ",
          "month": "mese ",
          "week": "dia de settimana"
        },
        "sep": ", ",
        "days": [
          "Domingo",
          "Segunda-feira",
          "Terça-feira",
          "Quarta-feira",
          "Quinta-feira",
          "Sexta-feira",
          "Sábado"
        ],
        "months": [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec"
        ]
      }
    },
    "convert": {
      "from": "From",
      "to": "To",
      "formats": {
        "yaml": "YAML",
        "json": "JSON",
        "toml": "TOML"
      },
      "input": "Entrada",
      "output": "Saída",
      "placeholder": "Colar ou conteúdo de convertire...",
      "err": {
        "PARSE": "Falha ao analisar a entrada: verifique a sintaxe",
        "STRINGIFY": "Não é possível converter para o formato de destino (p. ex. TOML não suporte arrays/escalares de nível superior)"
      }
    },
    "sql": {
      "dialect": "Dialeto",
      "indent": "Rientro",
      "keywordCase": "Keyword case",
      "cases": {
        "upper": "UPPERCASE",
        "lower": "lowercase",
        "preserve": "Conservare"
      },
      "languages": {
        "sql": "SQL genérico",
        "mysql": "Mysql",
        "postgresql": "PostgreSQL",
        "sqlite": "(SQLITE).",
        "mariadb": "MariaDB",
        "transactsql": "SQL Server",
        "plsql": "PL/SQL"
      },
      "input": "Input SQL",
      "output": "Saída",
      "placeholder": "Colar SQL, p. ex. SELECT * FROM users onde id = 1...",
      "err": {
        "INVALID": "Não é possível analisar este SQL: verifique a sintaxe"
      }
    },
    "html": {
      "actions": {
        "format": "Embelezar",
        "compress": "Minify"
      },
      "indent": "Rientro",
      "indent2": "2 espaços",
      "indent4": "4 espaços",
      "input": "Entrada HTML",
      "placeholder": "Colar HTML, p. ex. <div><span>Ciao</span></div>…",
      "err": {
        "EMPTY": "Introduza ou conteúdo",
        "INVALID": "Elaboração não bem-sucedida: controlla se ou HTML é válido"
      }
    },
    "js": {
      "actions": {
        "format": "Embelezar",
        "compress": "Minify"
      },
      "indent": "Rientro",
      "indent2": "2 espaços",
      "indent4": "4 espaços",
      "input": "Input JavaScript",
      "placeholder": "Colar JS, p. ex. função hello(){return 1}...",
      "err": {
        "EMPTY": "Introduza ou conteúdo",
        "INVALID": "Elaboração não bem-sucedida: controllare a sintassi"
      }
    },
    "css": {
      "actions": {
        "format": "Embelezar",
        "compress": "Minify"
      },
      "indent": "Rientro",
      "indent2": "2 espaços",
      "indent4": "4 espaços",
      "input": "Entrada CSS",
      "placeholder": "Colar CSS, p. ex. .box{color:red}...",
      "err": {
        "EMPTY": "Introduza ou conteúdo",
        "INVALID": "Elaboração não bem-sucedida: controlla se ou CSS é válido"
      }
    },
    "qr": {
      "input": "Contenuti testuali",
      "placeholder": "Introduza texto ou URL, p. ex. https://example.com…",
      "level": "Correção de erros",
      "size": "Size",
      "margin": "Margem",
      "foreground": "Primeiro plano",
      "background": "Fundo",
      "levels": {
        "L": "L/7",
        "M": "M 15",
        "Q": "d25",
        "H": "H : 30"
      },
      "preview": "QR code preview",
      "decodeTitle": "Descodificar código QR",
      "decodeHint": "Largue ou escolha uma imagem com um código QR (PNG / JPG, etc.)",
      "decodeOutput": "Resultado descodificado",
      "err": {
        "EMPTY": "Introduza o conteúdo a codificar",
        "TOO_LONG": "O conteúdo é demasiado longo para um código QR: encurte-o ou baixe o nível de correção de erros",
        "NOT_FOUND": "No QR code found in the image",
        "DECODE": "Falha ao descodificar a imagem",
        "LOAD": "Falha ao carregar a imagem: certifique-se de que é um ficheiro de imagem válido",
        "INVALID_COLOR": "A cor deve ser #RGB ou #RRGGBB",
        "INVALID_MARGIN": "A margem deve ser um inteiro de 0 a 10 (módulos)"
      }
    },
    "color": {
      "input": "Color",
      "placeholder": "e.g. #3b82f6, rgb(59,130,246), hsl(217,91%,60%)…",
      "preview": "Pré-visualização da cor",
      "supportHint": "Supporta HEX / RGB / HSL (incluídos stenografia e percentuali)",
      "err": {
        "EMPTY": "Introduza um valor de cor válido.",
        "INVALID": "Não é possível analisar: use o formato HEX, RGB ou HSL"
      }
    },
    "radix": {
      "radix": "Radix",
      "auto": "Deteção automática",
      "input": "Ingresso intero",
      "placeholder": "e.g. 255, 0xff, 0b11111111, 0377…",
      "bitPattern": "Padrão de bits",
      "twosComplement": "two's complement",
      "bitOps": "Operações bit a bit",
      "operator": "Addetto à condução",
      "operandB": "Operando B",
      "opHint": "L'operando A riutilizza ou input de cui acima; os risultati rimangono all'interno dell'intervallo de inteiros com sinal a 64 bit",
      "ops": {
        "and": "AND",
        "or": "OR",
        "xor": "XOR",
        "shl": "<< (shift left)",
        "shr": ">> (shift right)",
        "not": "NOT"
      },
      "err": {
        "EMPTY": "Immettere um número intero positivo.",
        "INVALID": "Não é possível analisar: verifique a base e o formato do número",
        "RANGE": "O valor está fora do intervalo de inteiros com sinal de 64 bits (−2⁶³ ~ 2⁶³−1)"
      }
    },
    "markdown": {
      "gfm": "GFM (tabelas / rasurado / listas de tarefas)",
      "breaks": "Interruções linha",
      "input": "Editor ribassi",
      "placeholder": "Introduza Markdown, p. ex. # Heading…",
      "preview": "Pré-visualização",
      "shortcuts": "Scorciatoie: + Ctrl+B grassetto · + Ctrl+I corsivo · + Ctrl+K link · + Ctrl+E codice inline",
      "toolbar": {
        "aria": "Barra de ferramentas do editor Markdown",
        "bold": "Negrito (**)",
        "italic": "Corsivo",
        "strike": "Barrato",
        "h1": "Cabeçalho 1 (#)",
        "h2": "Cabeçalho 2 (##)",
        "h3": "Cabeçalho 3 (###)",
        "h4": "Cabeçalho 4 (####)",
        "h5": "Cabeçalho 5 (#####)",
        "h6": "Cabeçalho 6 (######)",
        "quote": "Preventivo",
        "code": "Codice inline (`)",
        "codeBlock": "Bloco de código (```)",
        "link": "Link",
        "image": "Imagem",
        "ul": "Lista com marcas",
        "ol": "Lista numerato",
        "hr": "Elemento HTML",
        "table": "Table"
      },
      "err": {
        "EMPTY": "Introduza ou conteúdo",
        "PARSE": "Rendering não bem-sucedido: controlla a sintassi de Markdown"
      }
    },
    "image": {
      "format": "Formato output",
      "quality": "Qualidade",
      "maxDim": "MAx tamanho",
      "original": "Tamanho Originale",
      "dropHint": "Arraste e largue uma imagem aqui, ou clique para escolher (PNG / JPEG / WebP / GIF, etc.)",
      "before": "Originale",
      "after": "Saída",
      "saved": "Size reduced by {{ratio}}%",
      "increased": "Dimensões aumentate do {{ratio}} %",
      "err": {
        "NOT_IMAGE": "Escolha um'imagem do tuo PC",
        "ENCODE": "Codificação imagem não bem-sucedida: certifique-se che ou browser supporti este formato ou prova um'outra imagem"
      }
    },
    "jsonConvert": {
      "target": "Formato dati de destinação",
      "targets": {
        "yaml": "YAML",
        "xml": "XML",
        "csv": "CSV"
      },
      "input": "Ingresso 0",
      "placeholder": "Colar JSON, p. ex. [{\"id\":1,\"name\":\"a\"}]...",
      "err": {
        "PARSE": "JSON analisi não bem-sucedida: controllare a sintassi",
        "CONVERT": "Não é possível converter para o formato de destino (CSV requer um array de objetos)"
      }
    },
    "xml": {
      "actions": {
        "format": "Embelezar",
        "compress": "Minify"
      },
      "indent": "Rientro",
      "indent2": "2 espaços",
      "indent4": "4 espaços",
      "input": "Ingresso 0",
      "placeholder": "Colar XML, p. ex. <root><item>um</item></root>...",
      "err": {
        "EMPTY": "Introduza ou conteúdo",
        "INVALID": "Elaboração não bem-sucedida: controlla se ou XML é válido"
      }
    },
    "xmlJson": {
      "indent": "Rientro",
      "indent2": "2 espaços",
      "indent4": "4 espaços",
      "input": "Ingresso 0",
      "output": "JSON output",
      "placeholder": "Colar XML, p. ex. <root a=\"1\"><item>x</item></root>...",
      "err": {
        "EMPTY": "Introduza ou conteúdo",
        "PARSE": "XML analisi não bem-sucedida: controllare a sintassi"
      }
    },
    "unicode": {
      "format": "Format",
      "formats": {
        "js": "JS \\uXXXX",
        "jsBrace": "JS \\u{…}",
        "codePoint": "Ponto de código U+",
        "htmlHex": "0 X",
        "htmlDec": "HTML &#…;",
        "utf8": "0 byte"
      },
      "raw": "Texto normale",
      "encoded": "Texto codificado",
      "placeholderEncode": "Introduza texto, p. ex. 中 / A / 😀…",
      "placeholderDecode": "Introduza \\u4e2d, U+4E2D, &#x4E2D; ou E4 B8 AD…",
      "hint": "A descodificação aceita notações mistas; a codificação usa o formato selecionado",
      "err": {
        "EMPTY": "Introduza ou conteúdo",
        "INVALID": "Não é possível analisar: verifique a representação Unicode / UTF-8"
      }
    },
    "colorPicker": {
      "picker": "Addetto ao picking",
      "input": "Valore",
      "placeholder": "#3b82f6 / rgb(59,130,246)…",
      "eyedropper": "Contagocce para schermo",
      "preview": "Pré-visualização da cor",
      "fields": {
        "hex": "HEX",
        "rgb": "RGB",
        "hsl": "HSL",
        "cssColor": "Cor CSS",
        "cssBg": "Fundo CSS",
        "htmlInline": "Estilo HTML"
      },
      "err": {
        "EMPTY": "Inserire um cor válido",
        "INVALID": "Formato cor não riconosciuto"
      }
    },
    "webColorTable": {
      "search": "Search",
      "searchPlaceholder": "Nome / HEX / RGB…",
      "group": "Grupo",
      "groups": {
        "all": "All",
        "red": "Red",
        "orange": "Arancia",
        "yellow": "Yellow",
        "green": "Fagiolini",
        "cyan": "Cyan",
        "blue": "Blue",
        "purple": "Viola",
        "pink": "Pink",
        "brown": "Brown",
        "white": "White",
        "gray": "Gray",
        "black": "Black"
      },
      "count": "Mostrar {{n}} / {{total}} cores",
      "empty": "Nessun cor corrispondente",
      "swatch": "Swatch",
      "name": "Name",
      "hex": "HEX",
      "rgb": "RGB",
      "copyName": "Name",
      "copyHex": "HEX",
      "copyRgb": "RGB",
      "hint": "Cores com nome CSS (incl. aliases Grey e RebeccaPurple) para cor / fundo."
    },
    "pinyin": {
      "input": "Chinês",
      "output": "Pinyin",
      "placeholder": "Introduza chinês, p. ex. 你好世界…",
      "separator": "Separatore",
      "separators": {
        "space": "Spazio",
        "none": "None",
        "dash": "Travessão -"
      },
      "letterCase": "Case",
      "cases": {
        "lower": "Minuscolo",
        "upper": "Uppercase"
      },
      "tone": "Ativar tons",
      "hint": "Utilizza letture comuni; os caracteres polifonicos utilizzano a lettura predefinida",
      "err": {
        "EMPTY": "Introduza ou texto cinese"
      }
    },
    "length": {
      "value": "Valore",
      "from": "Unit",
      "placeholder": "e.g. 1.5",
      "units": {
        "mm": "Millimetri (mm)",
        "cm": "Centímetro cm",
        "m": "Metri (m):",
        "km": "Chilometri (km):",
        "in": "pollicos (em)",
        "ft": "Pé ft",
        "yd": "Cortile iarda",
        "mi": "Mile mi",
        "nmi": "Miglio nautico"
      },
      "err": {
        "EMPTY": "Introduza um número",
        "INVALID": "Inserire um número válido"
      }
    },
    "zhConvert": {
      "s2t": "→ Tradizionale semplificato",
      "t2s": "Tradizionale → semplificato",
      "simplified": "Simplified Chinese",
      "traditional": "Cinese tradizionale",
      "placeholderS2t": "Introduza chinês simplificado…",
      "placeholderT2s": "Introduza chinês tradicional…",
      "hint": "Mapeamento ao nível do carácter; nomes próprios podem diferir dos dicionários de frases OpenCC",
      "err": {
        "EMPTY": "Si prega de inserire ou texto"
      }
    },
    "weight": {
      "value": "Valore",
      "from": "Unit",
      "placeholder": "e.g. 1.5",
      "units": {
        "mg": "Milligrammo - mg",
        "g": "Grama g",
        "kg": "Chilogrammo (kg)",
        "t": "Tonnellata t",
        "oz": "Oncia oz",
        "lb": "Libbra libbra",
        "st": "Stone st"
      },
      "err": {
        "EMPTY": "Introduza um número",
        "INVALID": "Inserire um número válido"
      }
    },
    "textCounter": {
      "input": "Texto",
      "placeholder": "Colar ou digita ou texto de contare...",
      "emptyHint": "Le statisticas appariranno depois aver inserito ou texto",
      "stats": {
        "chars": "Caracteres (com espaços)",
        "charsNoSpace": "Caracteres (sem espaços)",
        "words": "Words",
        "cjk": "Caracteres CJK",
        "lines": "Linee",
        "paragraphs": "Paragrafi",
        "spaces": "Whitespace",
        "bytes": "0 byte",
        "utf16Length": "Lunghezza UTF-16"
      }
    },
    "calendar": {
      "title": "{{year}}-{{month}}",
      "weekStart": "Dia de inizio de settimana",
      "weekStarts": {
        "mon": "Segunda-feira",
        "sun": "Domingo"
      },
      "today": "Oggi",
      "prev": "Mês precedente",
      "next": "Mês successivo",
      "selected": "Data selezionata",
      "lunar": "Data lunare",
      "ganZhi": "Pilar do dia {{day}}",
      "festivals": "Ferie / termini",
      "restLabel": "Tipo de dia",
      "yi": "Adatto",
      "ji": "Evitar",
      "legendZh": "Il rosso segna os fine settimana ou as feste; 休 = riposo legale, 班 = dia lavorativo de trucco. Punte dell'almanacco a destra.",
      "legendEn": "I dias rossi são fine settimana ou festivi. L'inglese utilizza os dias festivi statunitensi (en-GB utilizza os dias festivi do Regno Unito).",
      "rest": {
        "off": "Festivo",
        "work": "Workday",
        "weekend": "Fine settimana"
      },
      "weekdays": {
        "0": "Sun",
        "1": "Mon",
        "2": "Tue",
        "3": "Wed",
        "4": "Thu",
        "5": "Fri",
        "6": "Sat"
      },
      "formats": {
        "iso": "ISO",
        "slash": "<g id=\"MIFDocuments.YellowBackgroundColor\">Slash</g>",
        "locale": "Impostações locali"
      }
    },
    "cssButton": {
      "label": "Label",
      "bg": "Fundo",
      "color": "Texto",
      "hoverBg": "Passagem do mouse",
      "borderColor": "Margem",
      "radius": "Ragem",
      "paddingX": "Bombatura X",
      "paddingY": "Bombatura Y",
      "fontSize": "Tamanho do tipo de letra",
      "borderWidth": "Largura da margem",
      "fontWeight": "Weight",
      "shadow": "Shadow",
      "fullWidth": "Largura total",
      "previewFallback": "Botão",
      "css": "CSS",
      "html": "HTML"
    },
    "randomNumber": {
      "min": "Min",
      "max": "Max",
      "count": "Quantidade",
      "decimals": "Decimais",
      "unique": "Único",
      "generate": "Gerar",
      "err": {
        "INVALID_RANGE": "Intervalo inválido: garantire min ≤ max e spazio sufficiente quando único",
        "INVALID_COUNT": "A quantidade deve ser um inteiro de 1 a 1000",
        "INVALID_DECIMALS": "Os decimais devem ser um inteiro de 0 a 10"
      }
    },
    "randomString": {
      "length": "Lung.",
      "count": "Quantidade",
      "preset": "Conjunto de caracteres",
      "presets": {
        "alnum": "Alfanumérico",
        "alpha": "Lettere",
        "hex": "Hex",
        "base64": "Base64",
        "custom": "Personalizado"
      },
      "custom": "Caracteres personalizados",
      "customPlaceholder": "Introduza caracteres permitidos…",
      "generate": "Gerar",
      "err": {
        "EMPTY_CHARSET": "Fornisci um set de caracteres não vazio",
        "INVALID_LENGTH": "O comprimento deve ser um número intero compreso entre 1 e 256",
        "INVALID_COUNT": "A quantidade deve ser um inteiro de 1 a 100"
      }
    },
    "doodle": {
      "size": "Size",
      "eraser": "Borracha",
      "clear": "Limpar",
      "download": "Exportar PNG",
      "hint": "Arraste no canvas para desenhar; suporta rato e toque"
    },
    "calculator": {
      "expression": "Expressão",
      "placeholder": "e.g. (1+2)*3 or sqrt(9)+pi",
      "functions": "Funções",
      "hint": "Supporta + - * / % ^ () e sqrt/abs/sin/cos/tan/ln/log/floor/ceil/round, mais pi ed e",
      "err": {
        "EMPTY": "Introduza um'expressão",
        "SYNTAX": "Sintassi dell'expressão inválida",
        "DIV_ZERO": "Divisão por zero"
      }
    },
    "codeImage": {
      "language": "Idioma",
      "theme": "Theme",
      "themes": {
        "dark": "Dark",
        "light": "Chiaro"
      },
      "lineNumbers": "Numeri de linha:",
      "padding": "Imbottiture",
      "download": "Exportar PNG",
      "exporting": "A exportar…",
      "input": "Code",
      "preview": "Pré-visualização",
      "placeholder": " Colar codice"
    },
    "imageColor": {
      "dropHint": "Largue ou escolha uma imagem (PNG / JPEG / WebP / GIF, etc.)",
      "empty": "Carregar um'imagem, portanto clique para campionare um cor",
      "picked": "Cor prelevato",
      "preview": "Pré-visualização da cor",
      "clickHint": "Clique num píxel da imagem para amostrar",
      "err": {
        "NOT_IMAGE": "Escolha um'imagem do tuo PC",
        "LOAD": "Falha ao carregar a imagem"
      }
    },
    "ascii": {
      "search": "Search",
      "searchPlaceholder": "Decimal / hex / carácter / nome…",
      "dec": "Dec",
      "hex": "Hex",
      "char": "Char",
      "name": "Name",
      "hint": "Os caracteres de controlo sem glifo mostram-se como ·; copie o carácter ou \\xHH"
    },
    "watermark": {
      "text": "Texto filigrana",
      "position": "Posição",
      "positions": {
        "top-left": "Esquerda em alto",
        "top-right": "Direita em alto",
        "center": "Centro",
        "bottom-left": "Inferior esquerda",
        "bottom-right": "Inferior direita",
        "tile": "Tile"
      },
      "color": "Color",
      "fontSize": "Tamanho do tipo de letra",
      "opacity": "Opacidade",
      "rotate": "Ruotare",
      "gap": "Gap",
      "dropHint": "Largue ou escolha uma imagem para marcar",
      "original": "Originale",
      "result": "Resultado",
      "download": "Transferir PNG",
      "err": {
        "NOT_IMAGE": "Escolha um'imagem do tuo PC",
        "ENCODE": "Elaboração não bem-sucedida: prova um'outra imagem"
      }
    },
    "caseConvert": {
      "mode": "Mode",
      "placeholder": "Introduza texto para converter…",
      "modes": {
        "upper": "UPPER CASE",
        "lower": "lettera minuscola",
        "title": "Iniziali maiúsculas",
        "sentence": "Maiuscole/minúsculas na frase",
        "swap": "sWAP cASE",
        "camel": "camelCase",
        "pascal": "PascalCase",
        "snake": "snake_case",
        "kebab": "kebab-case",
        "constant": "CONSTANT_CASE"
      },
      "err": {
        "EMPTY": "Inserisca algumas parole"
      }
    },
    "bmi": {
      "unit": "Sistema de unidade de misura",
      "metric": "Metrico (cm, kg)",
      "imperial": "Imperiale (em / lb)",
      "heightCm": "Altura (cm, ou metros)",
      "heightIn": "Altura (polegadas)",
      "weightKg": "Peso (kg)",
      "weightLb": "Peso (libbre)",
      "bmi": "BMI",
      "category": "Categoria",
      "categories": {
        "underweight": "Sotto Peso",
        "normal": "Normale",
        "overweight": "Sovrappeso",
        "obese": "Obeso"
      },
      "hint": "As categorias seguem os limiares WHO para adultos apenas como referência — não é aconselhamento médico.",
      "err": {
        "INVALID": "Introduza uma altura e um peso válidos",
        "RANGE": "I valores são fora de um intervallo ragionevole; controllare as unidade"
      }
    },
    "placeholder": {
      "width": "Width",
      "height": "Altura",
      "bg": "Fundo",
      "fg": "Cor do texto",
      "text": "Texto",
      "textPlaceholder": "Por predefinição usa as dimensões",
      "download": "Transferir PNG",
      "err": {
        "INVALID_SIZE": "La tamanho deve ser um número intero compreso entre 16 e 4000",
        "INVALID_COLOR": "A cor deve ser #RGB ou #RRGGBB"
      }
    },
    "imageMerge": {
      "direction": "Layout",
      "directions": {
        "horizontal": "Orizzontali",
        "vertical": "Vertical",
        "grid": "Grid"
      },
      "gap": "Espaço (px)",
      "dropHint": "Adicione imagens uma a uma (até {{max}})",
      "download": "Transferir PNG unido",
      "err": {
        "NOT_IMAGE": "Escolha um'imagem do tuo PC",
        "TOO_MANY": "Limite imagem raggiunto",
        "ENCODE": "Unione não bem-sucedida; riprova",
        "EMPTY": "Adicione pelo menos uma imagem"
      }
    },
    "cronGen": {
      "preset": "Preimpostações",
      "presetPick": "Escolha uma predefinição…",
      "presets": {
        "everyMinute": "Cada minuto",
        "hourly": "Ogni agora (all'agora)",
        "daily": "Diariamente às 00:00",
        "weekly": "Lun settimanale 00:00",
        "monthly": "Mensile ou dia 1 às 00:00"
      },
      "fields": {
        "minute": "Minuto",
        "hour": "Hour",
        "day": "Dia do mês",
        "month": "Mês",
        "weekday": "Dia da semana"
      },
      "modes": {
        "every": "Cada (*)",
        "value": "valor specificas",
        "range": "Range",
        "step": "Step",
        "list": "List"
      },
      "listPlaceholder": "e.g. 1,3,5",
      "everyHint": "Corrisponde a cada valor em este campo",
      "expression": "Expressão",
      "openParser": "Pré-visualização em Cron parser",
      "hint": "Standard 5 campi: minuto agora dia mese dia feriale (0 = domenica)",
      "err": {
        "INVALID_FIELD": "Valore do campo inválido; intervalli ed elenchi de controllo"
      }
    },
    "uaParser": {
      "input": "Agente utente",
      "placeholder": "Colar uma stringa User-Agent...",
      "useCurrent": "Usa ou browser atual",
      "field": "Campo",
      "name": "Name",
      "version": "Version",
      "extra": "Extra",
      "fields": {
        "browser": "Browser",
        "engine": "Motor",
        "os": "OS",
        "device": "Dispositivo",
        "cpu": "CPU"
      },
      "err": {
        "EMPTY": "Introduza um User-Agent"
      }
    },
    "latex": {
      "input": "LaTeX",
      "placeholder": "e.g. E = mc^2 or \\frac{a}{b}",
      "preview": "Pré-visualização",
      "displayMode": "Modo de visualização",
      "copyHtml": "Copiar HTML",
      "symbols": "Simboli rapidi",
      "formulasTitle": "Fórmulas clássicas",
      "downloadPng": "Exportar PNG",
      "downloadJpg": "Exportar JPG",
      "downloadSvg": "Exportar SVG",
      "exporting": "A exportar…",
      "empty": "Introduza uma fórmula para pré-visualizar",
      "hint": "Clique num símbolo para inserir no cursor; as fórmulas clássicas substituem o editor. Renderizado com KaTeX; macros exóticas podem falhar.",
      "categories": {
        "operators": "Operatori",
        "relations": "internazionali",
        "greek": "Letras gregas",
        "trig": "Trigonometria",
        "calculus": "Cálculo",
        "sumprod": "Somme & prodotti",
        "set": "Teoria dos insiemi",
        "logic": "Logica",
        "arrows": "Setas",
        "matrix": "Matricos e vettori",
        "special": "Special"
      },
      "formulas": {
        "einstein": "Massa-energia",
        "quadratic": "2. Formula quadratica",
        "pythagorean": "Teorema de Pitagora",
        "euler": "Identidade de Euler",
        "binomial": "Teorema do binómio",
        "taylor": "Serie de Taylor.",
        "gaussian": "Integral gaussiana",
        "cauchySchwarz": "Cauchy–Schwarz",
        "bayes": "Teorema de Bayes",
        "derivative": "Definição de derivada",
        "fourier": "Transformada de Fourier",
        "navierStokes": "Navier–Stokes",
        "maxwell": "Equação de Maxwell",
        "schrodinger": "L'equação de Schrödinger",
        "normalDist": "Distribução normale ",
        "matrix2x2Det": "Determinante 2×2"
      },
      "err": {
        "EMPTY": "Inserire uma fórmula valida",
        "RENDER": "Rendering não bem-sucedido: {{message}}"
      }
    },
    "countdown": {
      "hours": "H",
      "minutes": "M",
      "seconds": "S",
      "start": "Start",
      "pause": "Metti em pausa",
      "resume": "Resume",
      "reset": "Reset",
      "done": "Il tempo é expirado!",
      "err": {
        "INVALID": "Introduza horas / minutos / segundos válidos",
        "ZERO": "A duração deve ser maior que 0"
      }
    },
    "stopwatch": {
      "start": "Start",
      "pause": "Metti em pausa",
      "resume": "Resume",
      "reset": "Reset",
      "lap": "Lap",
      "lapIndex": "Lap",
      "lapTime": "Tempo de esecução",
      "totalTime": "Total"
    },
    "svgPng": {
      "input": "SVG source",
      "placeholder": "Colar SVG markup...",
      "dropHint": "Largue ou escolha um ficheiro .svg",
      "scale": "Scale",
      "transparent": "Fundo trasparente",
      "download": "Transferir PNG",
      "sizeHint": "Sorgente {{sw}} × {{sh}} → uscita {{pw}} × {{ph}}",
      "err": {
        "EMPTY": "Introduza SVG",
        "INVALID_SVG": "Not a valid SVG",
        "INVALID_SIZE": "Tamanho de uscita inválida (escala de controllo; margem máximo 8192)",
        "ENCODE": "A conversão falhou; verifique o SVG ou reduza a escala"
      }
    },
    "imageFrame": {
      "borderWidth": "Largura da margem",
      "borderColor": "Cor da margem",
      "radius": "Ragem",
      "shadowBlur": "Sfocatura sombra:",
      "shadowOffsetY": "Spostamento X sombra",
      "shadowOpacity": "Opacidade sombra",
      "dropHint": "Largue ou escolha uma imagem",
      "download": "Transferir PNG",
      "err": {
        "NOT_IMAGE": "Escolha um'imagem do tuo PC",
        "ENCODE": "Elaboração não bem-sucedida; prova um'outra imagem"
      }
    },
    "imageAdjust": {
      "brightness": "Brilho",
      "contrast": "Contraste",
      "saturate": "Saturação",
      "hue": "Hue",
      "reset": "Reset",
      "dropHint": "Largue ou escolha uma imagem para ajustar",
      "original": "Originale",
      "download": "Transferir PNG",
      "err": {
        "NOT_IMAGE": "Escolha um'imagem do tuo PC",
        "ENCODE": "Elaboração não bem-sucedida; prova um'outra imagem"
      }
    },
    "gifFrames": {
      "dropHint": "Largue ou escolha um ficheiro GIF",
      "meta": "{{w}}×{{h}} · {{n}} frames",
      "download": "Transferir",
      "downloadAll": "Transferir todos os fotogramas",
      "err": {
        "NOT_GIF": "Per favore escolha um ficheiro",
        "EMPTY": "O ficheiro está vazio",
        "PARSE": "Falha ao analisar o GIF"
      }
    },
    "imageCrop": {
      "aspect": "Aspeto",
      "aspects": {
        "free": "Free",
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
      "dropHint": "Largue ou escolha uma imagem para recortar",
      "hint": "Arraste para selecionar em modo livre, ou edite os valores abaixo",
      "download": "Transferir PNG",
      "err": {
        "NOT_IMAGE": "Escolha um'imagem do tuo PC",
        "ENCODE": "Falha ao recortar; tente novamente",
        "INVALID": "Regione de coltura inválida"
      }
    },
    "mbti": {
      "progress": "Respondidas {{done}} / {{total}}",
      "questionIndex": "Domanda {{n}} / {{total}}",
      "prev": "Anterior",
      "next": "Next",
      "submit": "vedi risultati",
      "reset": "Limpar",
      "retake": "Ripeti",
      "yourType": "Tendenza do tuo tipo",
      "hint": "Escolha ou opção mais adatta a te; invia quando hai risposto a todos.",
      "disclaimer": "Questo é um quiz semplificato apenas para intrattenimento, não uma valutação clinica.",
      "dims": {
        "EI": "Extroversão E / Introversão I",
        "SN": "Sensing S / Intuition N",
        "TF": "Thinking T / Feeling F",
        "JP": "Giudizio J / Perceção P"
      }
    },
    "textCard": {
      "theme": "Theme",
      "themes": {
        "slate": "Ardesia",
        "ocean": "Mare",
        "sunset": "TRAMONTO",
        "forest": "Foresta",
        "mono": "Mono",
        "paper": "Carta"
      },
      "align": "Alinhar",
      "aligns": {
        "left": "Left",
        "center": "Centro",
        "right": "Direita"
      },
      "fontSize": "Tamanho do tipo de letra",
      "padding": "Imbottiture",
      "width": "Width",
      "title": "Title",
      "titlePlaceholder": "Título opcional…",
      "body": "Body",
      "bodyPlaceholder": "Introduza texto para o cartão…",
      "preview": "Pré-visualização",
      "empty": "Introduza um título ou corpo para pré-visualizar",
      "download": "Exportar PNG",
      "exporting": "A exportar…"
    },
    "imageCard": {
      "shadow": "Shadow",
      "padding": "Imbottiture",
      "radius": "Raio do bloco",
      "width": "Width",
      "textPosition": "Posição da legenda",
      "positions": {
        "below": "Abaixo da foto",
        "above": "Acima da foto"
      },
      "align": "Alinhar",
      "aligns": {
        "left": "Left",
        "center": "Centro",
        "right": "Direita"
      },
      "textPadding": "<code>Padding</code> do texto.",
      "textBg": "Fundo texto",
      "titleSize": "Tamanho título",
      "subtitleSize": "Tamanho do sottotitolo",
      "rotate": "Rotação foto",
      "backdrop": "Fundo",
      "backdropModes": {
        "preset": "Preimpostação",
        "color": "Solid",
        "gradient": "Gradiente"
      },
      "backdropColor": "Cor de fundo",
      "gradientFrom": "From",
      "gradientTo": "To",
      "gradientAngle": "Ângulo",
      "backdrops": {
        "paper": "Carta",
        "fog": "Fog",
        "night": "Notte",
        "mint": "Mint",
        "sand": "Sand",
        "ink": "Ink",
        "sunset": "TRAMONTO",
        "ocean": "Mare",
        "lavender": "Lavanda",
        "peach": "Pesca ",
        "aurora": "Aurora",
        "charcoal": "Charcoal"
      },
      "title": "Title",
      "titlePlaceholder": "Título do cartão…",
      "subtitle": "Subtitle",
      "subtitlePlaceholder": "Linea de supporto...",
      "dropHint": "Largue ou escolha uma imagem para o cartão",
      "empty": "Carregar um'imagem para visualizzare ou pré-visualização de carta",
      "download": "Exportar PNG",
      "exporting": "A exportar…",
      "err": {
        "NOT_IMAGE": "Escolha um'imagem do tuo PC",
        "ENCODE": "Falha ao exportar; tente outra imagem"
      }
    },
    "codeHighlight": {
      "language": "Idioma",
      "theme": "Theme",
      "themes": {
        "dark": "Dark",
        "light": "Chiaro"
      },
      "lineNumbers": "Numeri de linha:",
      "input": "Code",
      "preview": "Pré-visualização evidenziata",
      "placeholder": " Colar codice",
      "copyCode": "Copiar código",
      "copyHtml": "Copiar HTML",
      "hint": "Powered by Prism; copy the HTML snippet for blogs and docs."
    },
    "imageBase64": {
      "upload": "Imagem 0",
      "uploadHint": "Largue ou escolha uma imagem",
      "copyDataUrl": "Copiar Data URL",
      "base64Out": "Base64",
      "paste": "Base64 → imagem",
      "pastePlaceholder": "Colar um dato URL ou RAW Base64...",
      "err": {
        "EMPTY": "Introduza Base64 ou escolha uma imagem",
        "INVALID_BASE64": "{0} inválido.&#x0D;",
        "NOT_IMAGE": "Escolha um'imagem do tuo PC"
      }
    },
    "imageIco": {
      "mode": "Mode",
      "toIco": "Imagem → ICO",
      "fromIco": "ICO",
      "sizes": "Misure",
      "uploadImageHint": "Largue ou escolha uma imagem PNG / JPG / WebP",
      "uploadIcoHint": "Largue ou escolha um ficheiro .ico",
      "convert": "Criar ICO",
      "converting": "Al lavoro...",
      "downloadIco": "Transferir ICO",
      "downloadPng": "Transferir PNG",
      "extracted": "Extraídos {{n}} tamanhos de {{name}}",
      "err": {
        "NOT_IMAGE": "Escolha um'imagem do tuo PC",
        "NOT_ICO": "Escolha um ficheiro ICO",
        "USE_FROM_ICO": "Passa a \"ICO → PNG\" para aprire um ficheiro ICO",
        "NO_SIZES": "selezionare almeno um'opção",
        "EMPTY": "O ficheiro está vazio",
        "INVALID_ICO": "\"Ficheiro danneggiato ou inválido\"",
        "ENCODE": "A conversão falhou; tente outra imagem"
      }
    },
    "hsvCmyk": {
      "preview": "Pré-visualização da cor"
    },
    "aiPrompts": {
      "search": "Search",
      "searchPlaceholder": "Parole chave",
      "category": "Categoria",
      "empty": "Nessuna richiesta corrispondente",
      "cat": {
        "all": "All",
        "writing": "Writing",
        "coding": "Programação",
        "translate": "Translate",
        "marketing": "Obiettivi",
        "learning": "Apprendimento",
        "career": "Carreira"
      }
    },
    "mdMindmap": {
      "input": "Markdown",
      "placeholder": "# Tópico\n## Ramo\n- Ponto…",
      "preview": "Mappa mentale",
      "theme": "Theme",
      "themes": {
        "sky": "Sky",
        "forest": "Foresta",
        "sunset": "TRAMONTO",
        "grape": "Uva",
        "ocean": "Mare",
        "mono": "Mono"
      },
      "zoomIn": "Ingrandisci",
      "zoomOut": "Riduci",
      "zoomReset": "Reimposta zoom",
      "zoomHint": "Tieni premuto CTRL /e scorri para ingrandire ou pré-visualização",
      "downloadSvg": "Exportar SVG",
      "downloadPng": "Exportar PNG",
      "download": "Exportar SVG",
      "exporting": "A exportar…",
      "empty": "Introduza cabeçalhos ou listas Markdown para gerar um mapa",
      "err": {
        "EMPTY": "Introduza um ribasso"
      }
    },
    "mermaid": {
      "input": "Sirena",
      "placeholder": "diagrama de flusso TD\n A-->B",
      "preview": "Pré-visualização",
      "theme": "Theme",
      "themes": {
        "default": "Predefinição",
        "neutral": "Indifferente",
        "forest": "Foresta",
        "dark": "Dark",
        "ocean": "Mare",
        "sunset": "TRAMONTO",
        "mono": "Mono"
      },
      "zoomIn": "Ingrandisci",
      "zoomOut": "Riduci",
      "zoomReset": "Reimposta zoom",
      "zoomHint": "Tieni premuto CTRL /e scorri para ingrandire ou pré-visualização",
      "downloadSvg": "Exportar SVG",
      "downloadPng": "Exportar PNG",
      "download": "Exportar SVG",
      "exporting": "A exportar…",
      "empty": "Introduza sintaxe Mermaid para renderizar",
      "rendering": "Rendering…",
      "err": {
        "RENDER": "Rendering não bem-sucedido: {{message}}"
      }
    },
    "cssGradient": {
      "type": "Type",
      "linear": "Lineare",
      "radial": "Segni",
      "angle": "Ângulo",
      "shape": "Shape",
      "preview": "Pré-visualização do gradiente",
      "stops": "Stops",
      "addStop": "Adicionar paragem",
      "position": "Posição %",
      "removeStop": "Remover",
      "css": "CSS",
      "presetsTitle": "Preimpostações",
      "presetCategories": {
        "warm": "Warm",
        "cool": "Cool",
        "nature": "Nature Green",
        "pink": "Rosa romantico",
        "purple": "Viola misterioso",
        "dark": "Dark",
        "light": "Chiaro",
        "rainbow": "Multicolore",
        "sunset": "TRAMONTO",
        "ocean": "Mare"
      },
      "presetNames": {
        "warm-golden": "sole d'oro",
        "warm-peach": "Pesca ",
        "warm-coral": "Coral",
        "warm-amber": "Amber",
        "warm-spice": "Arancia speziata",
        "warm-rose-gold": "Oro rosa",
        "warm-papaya": "Crema de papaya",
        "warm-flame": "Fiamma",
        "warm-honey": "Oro miele",
        "warm-terracotta": "Terracotta",
        "warm-mango": "Mango",
        "warm-autumn": "Autumn",
        "warm-cinnamon": "Cinnamon",
        "warm-tangerine": "Mandarino ",
        "warm-sunset-orange": "Arancione",
        "warm-brick": "Brick red",
        "warm-caramel": "Caramel",
        "warm-radial": "Bagliore caldo",
        "warm-saffron": "Zafferano",
        "warm-burnt": "Burnt sienna",
        "warm-apricot": "Apricot",
        "cool-arctic": "Arctic blue",
        "cool-ice": "Azzurro ghiaccio",
        "cool-frost": "Gelo",
        "cool-steel": "Steel gray",
        "cool-mint-ice": "Gelato de menta",
        "cool-glacier": "ghiacciai.",
        "cool-skyline": "Orizzonte",
        "cool-polar": "Polare",
        "cool-nordic": "Nordic gray",
        "cool-periwinkle": "Pervinca",
        "cool-cobalt": "Cobalt",
        "cool-teal-breeze": "Teal breeze",
        "cool-sapphire": "Zaffiro",
        "cool-winter": "Winter",
        "cool-azure": "Tricolor azur",
        "cool-denim": "Denim blue",
        "cool-moonlight": "MOONLIGHT",
        "cool-cyan": "Cyan blue",
        "cool-harbor": "Porto",
        "cool-iceberg": "Iceberg",
        "nature-forest": "Foresta",
        "nature-moss": "Moss",
        "nature-jungle": "Giungla",
        "nature-spring": "Spring",
        "nature-fern": "Fern",
        "nature-matcha": "Matcha",
        "nature-emerald": "Emerald",
        "nature-leaf": "Bagliore fogliare",
        "nature-bamboo": "Bamboo",
        "nature-pine": "Pineta",
        "nature-sage": "Sage",
        "nature-meadow": "Prato",
        "nature-rainforest": "Foresta pluviale",
        "nature-olive": "Verde oliva",
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
        "pink-lotus": "Loto",
        "pink-peony": "Peonia",
        "pink-strawberry": "Strawberry",
        "pink-fairy": "Rosa fada",
        "pink-magnolia": "Magnolia",
        "pink-petal": "Petalo",
        "pink-candy": "Candy pink",
        "pink-radial": "Pink Glow",
        "pink-rosewater": "Acqua de rose",
        "pink-ballet": "Ballet pink",
        "purple-galaxy": "Galassia",
        "purple-mystic": "Viola mistico",
        "purple-amethyst": "Amethyst",
        "purple-velvet": "Porpora vellutato",
        "purple-neon": "Neon purple",
        "purple-twilight": "Viola crepuscolare",
        "purple-royal": "ROYAL PURPLE",
        "purple-orb": "Sfera viola",
        "purple-lilac": "Lillà",
        "purple-indigo": "Viola indaco",
        "purple-plum": "Plum",
        "purple-cosmic": "Cosmic purple",
        "purple-dusk": "Crepuscolo viola",
        "purple-wine": "Viola vino",
        "purple-iris": "Iris",
        "purple-void": "Void",
        "purple-haze": "Purple Haze",
        "purple-orchid": "Violetto claro",
        "purple-aurora": "Aurora viola",
        "purple-midnight": "Midnight Purple",
        "dark-charcoal": "Charcoal",
        "dark-midnight": "Mezzanotte",
        "dark-slate": "Ardesia",
        "dark-eclipse": "Eclipse",
        "dark-carbon": "Carbon",
        "dark-noir": "Noir",
        "dark-abyss": "Abyss",
        "dark-spotlight": "Riflettore escuro",
        "dark-obsidian": "nera",
        "dark-graphite": "Grafite",
        "dark-onyx": "Onyx",
        "dark-storm": "Notte de tempesta",
        "dark-ink": "Nero inchiostro",
        "dark-vignette": "Vignette",
        "dark-smoke": "Smoke gray",
        "dark-raven": "Corvo",
        "dark-void": "Void black",
        "light-cloud": "Cloud",
        "light-pearl": "CAB",
        "light-mist": "Mist",
        "light-cream": "Cream",
        "light-linen": "Lino",
        "light-sand": "Sand",
        "light-lavender": "nebbia de lavanda",
        "light-glow": "Soft glow",
        "light-ivory": "Avorio",
        "light-snow": "Snow white",
        "light-blush": "Blush",
        "light-morning": "Mattina",
        "light-silk": "Silk",
        "light-frost": "Frost white",
        "light-champagne": "Champagne",
        "light-dawn": "Dawn",
        "light-powder": "Blu polvere",
        "light-cotton": "Cotton white",
        "rainbow-classic": "Classic rainbow",
        "rainbow-neon": "Neon multicolor",
        "rainbow-candy": "Candy",
        "rainbow-aurora": "Aurora",
        "rainbow-sunset": "Miscela tramonto",
        "rainbow-pastel": "Pastello",
        "rainbow-vivid": "Tricolore vivace",
        "rainbow-prism": "Prisma",
        "rainbow-spectrum": "Spectrum",
        "rainbow-holo": "Holographic",
        "rainbow-pop": "POP Art",
        "rainbow-soda": "Soda pop",
        "rainbow-tropical": "Tropicale",
        "rainbow-laser": "Laser",
        "rainbow-universe": "Universo",
        "rainbow-dream": "Dream color",
        "rainbow-galaxy": "Cor de galassia",
        "rainbow-confetti": "Confetti",
        "rainbow-cyber": "Cyber",
        "rainbow-retro": "Retro duo",
        "rainbow-synth": "Synthwave",
        "rainbow-cotton": "Cotton candy",
        "rainbow-electric": "Electric",
        "rainbow-sunrise": "Miscela Sunrise",
        "sunset-dusk": "Dusk",
        "sunset-horizon": "Orizzonte",
        "sunset-glow": "Afterglow",
        "sunset-beach": "Beach sunset",
        "sunset-desert": "Desert dusk",
        "sunset-evening": "Noite",
        "sunset-fire": "Cielo de fogo",
        "sunset-radial": "Tramonto radiale",
        "sunset-amber": "Amber dusk",
        "sunset-crimson": "Crimson dusk",
        "sunset-twilight": "Crepuscolo",
        "sunset-mango": "Crepuscolo de mango",
        "sunset-ember": "Ember",
        "sunset-sky": "Sky Dusk",
        "sunset-sahara": "Sahara",
        "sunset-golden": "Golden dusk",
        "sunset-coast": "Coastal dusk",
        "sunset-violet": "Crepuscolo viola",
        "sunset-radial-glow": "Sun disc Glow",
        "sunset-lake": "Crepuscolo do lago",
        "ocean-deep": "Deep ocean",
        "ocean-wave": "onda oceanica<g id=\"1\"> </g>",
        "ocean-lagoon": "Laguna",
        "ocean-reef": "Coral reef",
        "ocean-abyss": "Ocean abyss",
        "ocean-tide": "Tide",
        "ocean-coral": "Taupe",
        "ocean-bubble": "Sea bubble",
        "ocean-marine": "Marine blue",
        "ocean-aqua": "Aqua",
        "ocean-storm": "Mare IN tempesta",
        "ocean-seafoam": "Seafoam",
        "ocean-caribbean": "Caribbean",
        "ocean-pacific": "Pacific",
        "ocean-arctic": "Arctic sea",
        "ocean-turquoise": "Ciano",
        "ocean-depth": "Deep glow",
        "ocean-surf": "Surf",
        "ocean-kelp": "Kelp",
        "ocean-mist": "Nebbia marina",
        "ocean-pearl": "Perla marina"
      }
    },
    "imageToPaper": {
      "paper": "Carta",
      "orientation": "Orientamento",
      "portrait": "Ritratto",
      "landscape": "Orizzontale",
      "fit": "Fit",
      "contain": "Conter",
      "cover": "Cobrir",
      "margin": "Margem (mm)",
      "uploadHint": "Largue ou escolha uma imagem",
      "downloadPng": "Transferir PNG",
      "downloadPdf": "Exportar PDF",
      "exporting": "A exportar…",
      "err": {
        "NOT_IMAGE": "Escolha um'imagem do tuo PC",
        "INVALID_MARGIN": "Margem superiore inválido.",
        "INVALID_IMAGE": "Tamanho dell'imagem inválido"
      }
    },
    "mdToImage": {
      "gfm": "GFM",
      "breaks": "Interruções linha",
      "font": "Font",
      "fonts": {
        "sans": "Sans-serif",
        "serif": "Serif",
        "mono": "Monospace",
        "song": "Canzone (serif CJK)",
        "hei": "Hei (sem CJK)"
      },
      "fontSize": "Tamanho do tipo de letra",
      "width": "Width",
      "padding": "Imbottiture",
      "lineHeight": "Altura de linea",
      "fg": "Cor do texto",
      "bg": "Fundo",
      "download": "Exportar PNG",
      "exporting": "A exportar…",
      "input": "Markdown",
      "placeholder": "# Título\nCorpo…",
      "preview": "Pré-visualização",
      "err": {
        "EMPTY": "Introduza um ribasso",
        "PARSE": "Parse falhado!",
        "INVALID_COLOR": "A cor deve ser #RGB ou #RRGGBB",
        "INVALID_SIZE": "Tamanho do tipo de letra / largura / padding / entrelinha fora do intervalo",
        "INVALID_FONT": "Carácter não suportado"
      }
    },
    "chartGenerator": {
      "type": "Type",
      "types": {
        "bar": "Bar",
        "hbar": "Barra orizzontale",
        "line": "Line",
        "area": "Area",
        "pie": "Pie",
        "doughnut": "Donut",
        "scatter": "Dispersione"
      },
      "bar": "Bar",
      "line": "Line",
      "pie": "Pie",
      "title": "Title",
      "seriesLabel": "Etichetta serie",
      "legend": "Legend",
      "legends": {
        "top": "Top",
        "bottom": "Inferior",
        "left": "Left",
        "right": "Direita",
        "none": "Oculto"
      },
      "colorScheme": "Esquema de cores",
      "schemes": {
        "vibrant": "Vibrant",
        "pastel": "Pastello",
        "ocean": "Mare",
        "sunset": "TRAMONTO",
        "forest": "Foresta",
        "mono": "Mono",
        "rainbow": "raiNbow"
      },
      "xLabel": "Etichetta Asse X",
      "yLabel": "Etichetta Asse Y",
      "xLabelPlaceholder": "e.g. Month",
      "yLabelPlaceholder": "e.g. Sales",
      "color": "Color",
      "width": "Width",
      "height": "Altura",
      "data": "Dados (CSV)",
      "dataPlaceholder": "label,value\napple,30\nbanana,20",
      "preview": "Pré-visualização",
      "downloadSvg": "Transferir SVG",
      "downloadPng": "Transferir PNG",
      "copySvg": "Copiar SVG",
      "err": {
        "EMPTY": "Inserire todos os dati",
        "INVALID": "Formato dati inválido",
        "NO_NUMERIC": "Nessun valor numerico encontrado"
      }
    },
    "css3Generator": {
      "linked": "Collega os angoli",
      "topLeft": "Esquerda em alto",
      "topRight": "Direita em alto",
      "bottomRight": "Inferior direita",
      "bottomLeft": "Inferior esquerda",
      "offsetX": "Offset X",
      "offsetY": "Offset Y",
      "blur": "Blur",
      "spread": "Spread",
      "color": "Color",
      "inset": "Inset",
      "translateX": "Trasla X",
      "translateY": "Trasla Y",
      "rotate": "Ruotare",
      "scale": "Scale",
      "skewX": "Inclinação X:",
      "property": "Proprietà",
      "duration": "Duração (s)",
      "timing": "Timing",
      "delay": "Atraso (s)",
      "brightness": "Brilho",
      "contrast": "Contraste",
      "saturate": "Satura",
      "grayscale": "Escala de cinzentos",
      "hueRotate": "Tinta-Rotação",
      "preview": "Pré-visualização",
      "previewLabel": "Pré-visualização",
      "css": "CSS",
      "modules": {
        "borderRadius": "Ragem",
        "boxShadow": "Sombra da caixa",
        "textShadow": "Sombra texto",
        "transform": "Transform",
        "transition": "Transition",
        "filter": "Filtrar"
      }
    },
    "pdf-merge": {
      "hint": "Unisce localmente — não viene carregado nulla. Preferisci ficheiro < 50 MB.",
      "drop": "Largue vários PDF",
      "run": "Unir e transfira",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-split": {
      "hint": "Si divide em um PDF para página e transfira cada.",
      "asZip": "Transferir como ZIP",
      "drop": "Largue um PDF",
      "run": "Dividir e transfira",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-delete-pages": {
      "hint": "Páginas de eliminare, p. ex. 1,3-5. Deve rimanere almeno uma página.",
      "pages": "Páginas de eliminare",
      "run": "Eliminar e transferir",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-extract-pages": {
      "hint": "Páginas de estrarre, p. ex. 1,3-5.",
      "pages": "Páginas de estrarre",
      "run": "Extrair e transferir",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-reorder": {
      "hint": "Utilizzare as frecce para riordinare as páginas, portanto esportare.",
      "pagesUnit": "pages",
      "pageLabel": "Page {{n}}",
      "run": "Aplicar e transferir",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-rotate": {
      "hint": "Escolha um ângulo para todas as páginas ou as selecionadas.",
      "allPages": "Todas as páginas",
      "pages": "Pages",
      "run": "Rodar e transfira",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-to-image": {
      "hint": "Esegue ou rendering localmente; os ficheiro de grandi dimensioni potrebbero essere lenti.",
      "scale": "Scale",
      "pages": "Páginas (facoltativo)",
      "pagesAll": "Lasciare vazio para todos",
      "run": "Exportar imagens",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "images-to-pdf": {
      "hint": "Un'imagem para página em formato pixel.",
      "drop": "Largue imagens",
      "run": "Criar PDF",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-viewer": {
      "hint": "Pré-visualização local — não viene carregado nulla.",
      "prev": "Prev",
      "next": "Next",
      "scale": "Scale",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-page-numbers": {
      "hint": "O formato suporta {n} e {total}.",
      "format": "Format",
      "fontSize": "Tamanho do tipo de letra",
      "startFrom": "Inizia de",
      "run": "Adicionar e transferir",
      "pos": {
        "bottom-center": "Inferior centro",
        "bottom-left": "Inferior esquerda",
        "bottom-right": "Inferior direita",
        "top-center": "Centro em alto"
      },
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-header-footer": {
      "hint": "Fornire almeno um'cabeçalho ou um rodapé.",
      "header": "Header",
      "footer": "Footer",
      "fontSize": "Tamanho do tipo de letra",
      "run": "Aplicar e transferir",
      "align": {
        "left": "Left",
        "center": "Centro",
        "right": "Direita"
      },
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-insert-image": {
      "hint": "L'origine é em basso a sinistra de página (PDF corde).",
      "pdf": "PDF file",
      "image": "Imagem (PNG/JPG)",
      "allPages": "Todas as páginas",
      "pages": "Pages",
      "width": "Width",
      "run": "Introduza Download",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-add-text": {
      "hint": "L'origine é em basso a sinistra; ou complexo Unicode pode essere limitado.",
      "text": "Texto",
      "allPages": "Todas as páginas",
      "pages": "Pages",
      "fontSize": "Tamanho do tipo de letra",
      "color": "Color",
      "run": "Adicionar e transferir",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-sign": {
      "hint": "Assinatura visiva (imagem sovrapposta), não certificato digitale.",
      "upload": "Carregar assinatura",
      "draw": "Desenhar assinatura",
      "allPages": "Todas as páginas",
      "pages": "Pages",
      "width": "Width",
      "run": "Assinatura e transfira",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-metadata": {
      "hint": "Edite título, autor e outros metadados, depois transfira.",
      "pages": "{{n}} pages",
      "run": "Guardar e transfira",
      "fields": {
        "title": "Title",
        "author": "Autor",
        "subject": "Subject",
        "keywords": "Keywords",
        "creator": "Criador",
        "producer": "Produttore"
      },
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-encrypt": {
      "hint": "Imposta palavra-passe e autorizzações de apertura. Il supporto do lettore varia.",
      "userPassword": "Palavra-passe utente",
      "ownerPassword": "Proprietario Palavra-passe",
      "ownerHint": "Se estiver vazio, usa a palavra-passe do utilizador",
      "run": "Encriptar e transferir",
      "perm": {
        "printing": "Permitir imprimir",
        "copying": "Permitir copiar",
        "modifying": "Permitir modificar",
        "annotating": "Permitir anotar"
      },
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-crop": {
      "hint": "Margini em PDF punti (pt ≈ 1/72 pollicos).",
      "top": "Top",
      "right": "Direita",
      "bottom": "Inferior",
      "left": "Left",
      "run": "Recortar e transferir",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-grayscale": {
      "hint": "Escala de grigi visiva através de a ri-rasterizzação das páginas; ou texto não rimarrà selezionabile.",
      "run": "Converter e transferir",
      "errors": {
        "EMPTY": "Si prega de completare ou input",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "pdf-annotate": {
      "hint": "Abrir um PDF e disegna annotações sobre a página: penna, evidenziação, rettangolo, ellisse, cerchio, linea e texto.",
      "drop": "Largue um PDF",
      "stroke": "Stroke",
      "fontSize": "Tamanho do tipo de letra",
      "scale": "Zoom",
      "undo": "Undo",
      "clearPage": "Limpar página",
      "prev": "Prev",
      "next": "Next",
      "count": "{{n}} annotation(s)",
      "textPrompt": "Introduza texto de anotação",
      "needVisitPage": "Open page {{n}} first so it can be rendered before export",
      "run": "Exportar PDF anotado",
      "kinds": {
        "pen": "Pen",
        "highlight": "Realçar",
        "rect": "Rettangolo",
        "ellipse": "Elipse",
        "circle": "Círculo",
        "line": "Line",
        "text": "Texto"
      },
      "errors": {
        "EMPTY": "Desenhe pelo menos uma anotação primeiro",
        "NOT_PDF": "Si prega de caricare um ficheiro",
        "NOT_IMAGE": "Si prega de caricare um'imagem.",
        "LOAD_FAILED": "Falha ao carregar o PDF",
        "NO_PAGES": "O documento não tem páginas",
        "INVALID_RANGE": "Intervalo páginas inválido.",
        "TOO_LARGE": "Ficheiro demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Falha de encriptação",
        "PROCESS_FAILED": "Elaboração não bem-sucedida. "
      }
    },
    "xsltTransform": {
      "sample": "Carregar exemplo",
      "xml": "XML",
      "xmlPlaceholder": "Colar",
      "xslt": "XSLT",
      "xsltPlaceholder": "Colar foglio de stile XSLT...",
      "output": "Saída",
      "preview": "Pré-visualização HTML",
      "err": {
        "EMPTY_XML": "Introduza XML",
        "EMPTY_XSLT": "Per favore introduza",
        "INVALID_XML": "{0} inválido.&#x0D;",
        "INVALID_XSLT": "XSLT inválido",
        "TRANSFORM": "Trasformação não bem-sucedida"
      }
    }
  }
} satisfies TranslationResources;

export default pt;
