/**
 * LaTeX 快捷符号与经典公式（插入片段）。
 */

export interface LatexSnippet {
  /** 按钮上显示的简短标签 */
  label: string;
  /** 插入的 LaTeX */
  latex: string;
  /** 中文说明（tooltip） */
  hintZh: string;
  /** 英文说明（tooltip） */
  hintEn: string;
}

export interface LatexCategory {
  id:
    | 'operators'
    | 'relations'
    | 'greek'
    | 'trig'
    | 'calculus'
    | 'sumprod'
    | 'set'
    | 'logic'
    | 'arrows'
    | 'matrix'
    | 'special';
  items: LatexSnippet[];
}

export interface ClassicFormula {
  id: string;
  latex: string;
}

function sn(label: string, latex: string, hintZh: string, hintEn: string): LatexSnippet {
  return { label, latex, hintZh, hintEn };
}

export const LATEX_CATEGORIES: LatexCategory[] = [
  {
    id: 'operators',
    items: [
      sn('±', '\\pm', '正负号', 'Plus or minus'),
      sn('∓', '\\mp', '负正号', 'Minus or plus'),
      sn('×', '\\times', '乘号', 'Multiplication sign'),
      sn('÷', '\\div', '除号', 'Division sign'),
      sn('·', '\\cdot', '中点乘', 'Centered dot product'),
      sn('∗', '\\ast', '星号运算', 'Asterisk operator'),
      sn('⋆', '\\star', '星形算子', 'Star operator'),
      sn('∘', '\\circ', '复合 / 圆圈算子', 'Composition / circle'),
      sn('∙', '\\bullet', '实心圆点', 'Bullet operator'),
      sn('⊕', '\\oplus', '直和 / 异或', 'Direct sum / XOR'),
      sn('⊗', '\\otimes', '张量积', 'Tensor product'),
      sn('⊙', '\\odot', '圆点乘', 'Circled dot'),
      sn('⊖', '\\ominus', '圆圈减', 'Circled minus'),
      sn('⊘', '\\oslash', '圆圈除', 'Circled slash'),
      sn('√', '\\sqrt{}', '平方根', 'Square root'),
      sn('ⁿ√', '\\sqrt[n]{}', 'n 次方根', 'nth root'),
      sn('a/b', '\\frac{}{}', '分数', 'Fraction'),
      sn('a⁄b', '\\dfrac{}{}', '展示型分数', 'Display-style fraction'),
      sn('aᵇ', '^{}', '上标', 'Superscript'),
      sn('aᵦ', '_{}', '下标', 'Subscript'),
      sn('|x|', '\\left|{}\\right|', '绝对值', 'Absolute value'),
      sn('‖x‖', '\\left\\|{}\\right\\|', '范数', 'Norm'),
      sn('( )', '\\left({}\\right)', '自适应圆括号', 'Auto-sized parentheses'),
      sn('[ ]', '\\left[{}\\right]', '自适应方括号', 'Auto-sized brackets'),
      sn('{ }', '\\left\\{{}\\right\\}', '自适应花括号', 'Auto-sized braces'),
      sn('⌊ ⌋', '\\lfloor {} \\rfloor', '向下取整', 'Floor'),
      sn('⌈ ⌉', '\\lceil {} \\rceil', '向上取整', 'Ceiling'),
    ],
  },
  {
    id: 'relations',
    items: [
      sn('≠', '\\neq', '不等于', 'Not equal'),
      sn('≈', '\\approx', '约等于', 'Approximately equal'),
      sn('≅', '\\cong', '同构 / 全等', 'Congruent / isomorphic'),
      sn('≡', '\\equiv', '恒等 / 同余', 'Identical / congruent'),
      sn('∼', '\\sim', '相似 / 渐近', 'Similar / asymptotic'),
      sn('≃', '\\simeq', '近似等于', 'Asymptotically equal'),
      sn('∝', '\\propto', '成正比', 'Proportional to'),
      sn('≤', '\\leq', '小于等于', 'Less than or equal'),
      sn('≥', '\\geq', '大于等于', 'Greater than or equal'),
      sn('≪', '\\ll', '远小于', 'Much less than'),
      sn('≫', '\\gg', '远大于', 'Much greater than'),
      sn('≲', '\\lesssim', '小于约等于', 'Less than or approx'),
      sn('≳', '\\gtrsim', '大于约等于', 'Greater than or approx'),
      sn('≺', '\\prec', '先于', 'Precedes'),
      sn('≻', '\\succ', '后于', 'Succeeds'),
      sn('≼', '\\preceq', '先于或等于', 'Precedes or equal'),
      sn('≽', '\\succeq', '后于或等于', 'Succeeds or equal'),
      sn('⊂', '\\subset', '真子集', 'Proper subset'),
      sn('⊃', '\\supset', '真超集', 'Proper superset'),
      sn('⊆', '\\subseteq', '子集', 'Subset or equal'),
      sn('⊇', '\\supseteq', '超集', 'Superset or equal'),
      sn('∈', '\\in', '属于', 'Element of'),
      sn('∉', '\\notin', '不属于', 'Not an element of'),
      sn('∋', '\\ni', '包含（作为元素）', 'Contains as member'),
      sn('⊢', '\\vdash', '可推出', 'Proves / turnstile'),
      sn('⊨', '\\models', '满足 / 语义蕴涵', 'Models / entails'),
      sn('⊥', '\\perp', '垂直 / 独立', 'Perpendicular / independent'),
      sn('∥', '\\parallel', '平行', 'Parallel'),
      sn('⋈', '\\bowtie', '自然连接', 'Natural join / bowtie'),
    ],
  },
  {
    id: 'greek',
    items: [
      sn('α', '\\alpha', '希腊字母 alpha', 'Greek letter alpha'),
      sn('β', '\\beta', '希腊字母 beta', 'Greek letter beta'),
      sn('γ', '\\gamma', '希腊字母 gamma', 'Greek letter gamma'),
      sn('δ', '\\delta', '希腊字母 delta', 'Greek letter delta'),
      sn('ε', '\\varepsilon', '变体 epsilon', 'Variant epsilon'),
      sn('ζ', '\\zeta', '希腊字母 zeta', 'Greek letter zeta'),
      sn('η', '\\eta', '希腊字母 eta', 'Greek letter eta'),
      sn('θ', '\\theta', '希腊字母 theta', 'Greek letter theta'),
      sn('ϑ', '\\vartheta', '变体 theta', 'Variant theta'),
      sn('ι', '\\iota', '希腊字母 iota', 'Greek letter iota'),
      sn('κ', '\\kappa', '希腊字母 kappa', 'Greek letter kappa'),
      sn('λ', '\\lambda', '希腊字母 lambda', 'Greek letter lambda'),
      sn('μ', '\\mu', '希腊字母 mu', 'Greek letter mu'),
      sn('ν', '\\nu', '希腊字母 nu', 'Greek letter nu'),
      sn('ξ', '\\xi', '希腊字母 xi', 'Greek letter xi'),
      sn('π', '\\pi', '希腊字母 pi', 'Greek letter pi'),
      sn('ρ', '\\rho', '希腊字母 rho', 'Greek letter rho'),
      sn('σ', '\\sigma', '希腊字母 sigma', 'Greek letter sigma'),
      sn('ς', '\\varsigma', '词尾 sigma', 'Final sigma'),
      sn('τ', '\\tau', '希腊字母 tau', 'Greek letter tau'),
      sn('υ', '\\upsilon', '希腊字母 upsilon', 'Greek letter upsilon'),
      sn('φ', '\\varphi', '变体 phi', 'Variant phi'),
      sn('ϕ', '\\phi', '希腊字母 phi', 'Greek letter phi'),
      sn('χ', '\\chi', '希腊字母 chi', 'Greek letter chi'),
      sn('ψ', '\\psi', '希腊字母 psi', 'Greek letter psi'),
      sn('ω', '\\omega', '希腊字母 omega', 'Greek letter omega'),
      sn('Γ', '\\Gamma', '大写 Gamma', 'Capital Gamma'),
      sn('Δ', '\\Delta', '大写 Delta', 'Capital Delta'),
      sn('Θ', '\\Theta', '大写 Theta', 'Capital Theta'),
      sn('Λ', '\\Lambda', '大写 Lambda', 'Capital Lambda'),
      sn('Ξ', '\\Xi', '大写 Xi', 'Capital Xi'),
      sn('Π', '\\Pi', '大写 Pi', 'Capital Pi'),
      sn('Σ', '\\Sigma', '大写 Sigma', 'Capital Sigma'),
      sn('Υ', '\\Upsilon', '大写 Upsilon', 'Capital Upsilon'),
      sn('Φ', '\\Phi', '大写 Phi', 'Capital Phi'),
      sn('Ψ', '\\Psi', '大写 Psi', 'Capital Psi'),
      sn('Ω', '\\Omega', '大写 Omega', 'Capital Omega'),
    ],
  },
  {
    id: 'trig',
    items: [
      sn('sin', '\\sin', '正弦', 'Sine'),
      sn('cos', '\\cos', '余弦', 'Cosine'),
      sn('tan', '\\tan', '正切', 'Tangent'),
      sn('cot', '\\cot', '余切', 'Cotangent'),
      sn('sec', '\\sec', '正割', 'Secant'),
      sn('csc', '\\csc', '余割', 'Cosecant'),
      sn('arcsin', '\\arcsin', '反正弦', 'Arcsine'),
      sn('arccos', '\\arccos', '反余弦', 'Arccosine'),
      sn('arctan', '\\arctan', '反正切', 'Arctangent'),
      sn('sinh', '\\sinh', '双曲正弦', 'Hyperbolic sine'),
      sn('cosh', '\\cosh', '双曲余弦', 'Hyperbolic cosine'),
      sn('tanh', '\\tanh', '双曲正切', 'Hyperbolic tangent'),
      sn('coth', '\\coth', '双曲余切', 'Hyperbolic cotangent'),
      sn('sin²', '\\sin^{2}', '正弦的平方', 'Sine squared'),
      sn('cos²', '\\cos^{2}', '余弦的平方', 'Cosine squared'),
    ],
  },
  {
    id: 'calculus',
    items: [
      sn('d/dx', '\\frac{\\mathrm{d}}{\\mathrm{d}x}', '对 x 求导', 'Derivative w.r.t. x'),
      sn('∂/∂x', '\\frac{\\partial}{\\partial x}', '对 x 偏导', 'Partial derivative w.r.t. x'),
      sn('∂', '\\partial', '偏微分符号', 'Partial derivative symbol'),
      sn('∇', '\\nabla', '梯度 / 那布拉算子', 'Nabla / gradient'),
      sn('∫', '\\int', '积分', 'Integral'),
      sn('∬', '\\iint', '二重积分', 'Double integral'),
      sn('∭', '\\iiint', '三重积分', 'Triple integral'),
      sn('∮', '\\oint', '曲线积分（闭合）', 'Contour integral'),
      sn('∫ₐᵇ', '\\int_{a}^{b}', '定积分 a 到 b', 'Definite integral from a to b'),
      sn("f'", "f'", '一阶导数', 'First derivative'),
      sn('f″', "f''", '二阶导数', 'Second derivative'),
      sn('lim', '\\lim', '极限', 'Limit'),
      sn('lim→', '\\lim_{x \\to {}}', 'x 趋于某值的极限', 'Limit as x approaches'),
      sn('∞', '\\infty', '无穷大', 'Infinity'),
      sn('dx', '\\,\\mathrm{d}x', '微分元 dx', 'Differential dx'),
    ],
  },
  {
    id: 'sumprod',
    items: [
      sn('∑', '\\sum', '求和', 'Summation'),
      sn('∑ᵢⁿ', '\\sum_{i=1}^{n}', '从 i=1 到 n 求和', 'Sum from i=1 to n'),
      sn('∏', '\\prod', '连乘', 'Product'),
      sn('∏ᵢⁿ', '\\prod_{i=1}^{n}', '从 i=1 到 n 连乘', 'Product from i=1 to n'),
      sn('⋃', '\\bigcup', '大并集', 'Big union'),
      sn('⋂', '\\bigcap', '大交集', 'Big intersection'),
      sn('⊔', '\\bigsqcup', '不交并', 'Disjoint union'),
      sn('⋁', '\\bigvee', '大析取', 'Big vee / join'),
      sn('⋀', '\\bigwedge', '大合取', 'Big wedge / meet'),
      sn('⊕∑', '\\bigoplus', '大直和', 'Big direct sum'),
      sn('⊗∏', '\\bigotimes', '大张量积', 'Big tensor product'),
      sn('max', '\\max', '最大值', 'Maximum'),
      sn('min', '\\min', '最小值', 'Minimum'),
      sn('sup', '\\sup', '上确界', 'Supremum'),
      sn('inf', '\\inf', '下确界', 'Infimum'),
      sn('arg', '\\arg', '辐角 / 参数', 'Argument'),
    ],
  },
  {
    id: 'set',
    items: [
      sn('∅', '\\emptyset', '空集', 'Empty set'),
      sn('∅̸', '\\varnothing', '空集（变体）', 'Empty set (variant)'),
      sn('ℕ', '\\mathbb{N}', '自然数集', 'Natural numbers'),
      sn('ℤ', '\\mathbb{Z}', '整数集', 'Integers'),
      sn('ℚ', '\\mathbb{Q}', '有理数集', 'Rational numbers'),
      sn('ℝ', '\\mathbb{R}', '实数集', 'Real numbers'),
      sn('ℂ', '\\mathbb{C}', '复数集', 'Complex numbers'),
      sn('∪', '\\cup', '并集', 'Union'),
      sn('∩', '\\cap', '交集', 'Intersection'),
      sn('∖', '\\setminus', '差集', 'Set difference'),
      sn('△', '\\triangle', '三角形 / 对称差常用记号', 'Triangle / often symmetric difference'),
      sn('⊂', '\\subset', '真子集', 'Proper subset'),
      sn('⊆', '\\subseteq', '子集', 'Subset or equal'),
      sn('⊊', '\\subsetneq', '真子集（强调不等）', 'Proper subset (neq)'),
      sn('∈', '\\in', '属于', 'Element of'),
      sn('∉', '\\notin', '不属于', 'Not an element of'),
      sn('{x|}', '\\{ x \\mid  \\}', '集合构造式', 'Set-builder notation'),
      sn('×', '\\times', '笛卡尔积', 'Cartesian product'),
      sn('℘', '\\mathcal{P}', '幂集', 'Power set'),
    ],
  },
  {
    id: 'logic',
    items: [
      sn('¬', '\\neg', '否定', 'Negation'),
      sn('∧', '\\land', '合取（且）', 'Logical and'),
      sn('∨', '\\lor', '析取（或）', 'Logical or'),
      sn('⊕', '\\oplus', '异或', 'Exclusive or'),
      sn('⇒', '\\Rightarrow', '蕴涵（双线箭头）', 'Implies'),
      sn('⇔', '\\Leftrightarrow', '等价（双线）', 'If and only if'),
      sn('→', '\\rightarrow', '蕴涵 / 映射', 'Implies / maps to'),
      sn('↔', '\\leftrightarrow', '当且仅当', 'If and only if'),
      sn('∀', '\\forall', '任意 / 全称量词', 'For all'),
      sn('∃', '\\exists', '存在量词', 'There exists'),
      sn('∄', '\\nexists', '不存在', 'There does not exist'),
      sn('⊤', '\\top', '真 / 顶', 'True / top'),
      sn('⊥', '\\bot', '假 / 底 / 矛盾', 'False / bottom'),
      sn('⊢', '\\vdash', '语法可推出', 'Syntactic entailment'),
      sn('⊨', '\\models', '语义满足', 'Semantic entailment'),
      sn('∴', '\\therefore', '所以', 'Therefore'),
      sn('∵', '\\because', '因为', 'Because'),
    ],
  },
  {
    id: 'arrows',
    items: [
      sn('←', '\\leftarrow', '左箭头', 'Left arrow'),
      sn('→', '\\rightarrow', '右箭头', 'Right arrow'),
      sn('↔', '\\leftrightarrow', '左右箭头', 'Left-right arrow'),
      sn('⇐', '\\Leftarrow', '双线左箭头', 'Left double arrow'),
      sn('⇒', '\\Rightarrow', '双线右箭头', 'Right double arrow'),
      sn('⇔', '\\Leftrightarrow', '双线左右箭头', 'Left-right double arrow'),
      sn('↦', '\\mapsto', '映射到', 'Maps to'),
      sn('⟵', '\\longleftarrow', '长左箭头', 'Long left arrow'),
      sn('⟶', '\\longrightarrow', '长右箭头', 'Long right arrow'),
      sn('⟷', '\\longleftrightarrow', '长左右箭头', 'Long left-right arrow'),
      sn('↑', '\\uparrow', '上箭头', 'Up arrow'),
      sn('↓', '\\downarrow', '下箭头', 'Down arrow'),
      sn('↕', '\\updownarrow', '上下箭头', 'Up-down arrow'),
      sn('⇑', '\\Uparrow', '双线上箭头', 'Up double arrow'),
      sn('⇓', '\\Downarrow', '双线下箭头', 'Down double arrow'),
      sn('↗', '\\nearrow', '东北箭头', 'North-east arrow'),
      sn('↘', '\\searrow', '东南箭头', 'South-east arrow'),
      sn('↙', '\\swarrow', '西南箭头', 'South-west arrow'),
      sn('↖', '\\nwarrow', '西北箭头', 'North-west arrow'),
      sn('↷', '\\hookrightarrow', '钩入右箭头', 'Hook right arrow'),
      sn('↩', '\\hookleftarrow', '钩入左箭头', 'Hook left arrow'),
      sn('⇀', '\\rightharpoonup', '右半箭头（上）', 'Right harpoon up'),
      sn('⇁', '\\rightharpoondown', '右半箭头（下）', 'Right harpoon down'),
    ],
  },
  {
    id: 'matrix',
    items: [
      sn('2×2', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', '2×2 圆括号矩阵', '2×2 parenthesis matrix'),
      sn(
        '3×3',
        '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}',
        '3×3 圆括号矩阵',
        '3×3 parenthesis matrix',
      ),
      sn('bmatrix', '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', '方括号矩阵', 'Bracket matrix'),
      sn('vmatrix', '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}', '行列式竖线矩阵', 'Determinant matrix'),
      sn('V', '\\begin{pmatrix} x \\\\ y \\\\ z \\end{pmatrix}', '列向量', 'Column vector'),
      sn('row', '\\begin{pmatrix} x & y & z \\end{pmatrix}', '行向量', 'Row vector'),
      sn('⋯', '\\cdots', '水平省略号（居中）', 'Centered horizontal dots'),
      sn('⋮', '\\vdots', '竖直省略号', 'Vertical dots'),
      sn('⋱', '\\ddots', '对角省略号', 'Diagonal dots'),
      sn('â', '\\hat{}', '帽号（估计量等）', 'Hat accent'),
      sn('ā', '\\bar{}', '上横线（平均等）', 'Bar accent'),
      sn('ã', '\\tilde{}', '波浪号', 'Tilde accent'),
      sn('a⃗', '\\vec{}', '向量箭头', 'Vector arrow'),
      sn('Aᵀ', '^{\\mathsf{T}}', '转置', 'Transpose'),
      sn('A⁻¹', '^{-1}', '逆', 'Inverse'),
      sn('⟨ ⟩', '\\langle {} \\rangle', '内积括号', 'Angle brackets / inner product'),
    ],
  },
  {
    id: 'special',
    items: [
      sn('…', '\\ldots', '基线省略号', 'Baseline ellipsis'),
      sn('⋯', '\\cdots', '居中省略号', 'Centered ellipsis'),
      sn('ℏ', '\\hbar', '约化普朗克常数', 'Reduced Planck constant'),
      sn('ℓ', '\\ell', '花体小写 L', 'Script lowercase L'),
      sn('ℜ', '\\Re', '实部', 'Real part'),
      sn('ℑ', '\\Im', '虚部', 'Imaginary part'),
      sn('∂', '\\partial', '偏微分', 'Partial'),
      sn('∇', '\\nabla', '梯度算子', 'Nabla'),
      sn('□', '\\square', '方框 / 达朗贝尔算子', 'Square / d’Alembertian'),
      sn('△', '\\triangle', '三角形', 'Triangle'),
      sn('∠', '\\angle', '角', 'Angle'),
      sn('°', '^\\circ', '度数', 'Degree'),
      sn('‰', '\\%', '百分号', 'Percent sign'),
      sn('†', '\\dagger', '匕首号 / 厄米共轭', 'Dagger / Hermitian'),
      sn('‡', '\\ddagger', '双匕首号', 'Double dagger'),
      sn('★', '\\star', '星号', 'Star'),
      sn('♠', '\\spadesuit', '黑桃', 'Spade suit'),
      sn('♥', '\\heartsuit', '红心', 'Heart suit'),
      sn('♦', '\\diamondsuit', '方块', 'Diamond suit'),
      sn('♣', '\\clubsuit', '梅花', 'Club suit'),
      sn('✓', '\\checkmark', '勾选标记', 'Check mark'),
      sn('text', '\\text{}', '文本模式', 'Text mode'),
      sn('mathrm', '\\mathrm{}', '直立罗马体', 'Upright roman'),
      sn('mathbf', '\\mathbf{}', '粗体', 'Bold'),
      sn('mathbb', '\\mathbb{}', '黑板粗体（数集）', 'Blackboard bold'),
      sn('mathcal', '\\mathcal{}', '花体', 'Calligraphic'),
      sn('mathfrak', '\\mathfrak{}', '哥特体', 'Fraktur'),
    ],
  },
];

export const CLASSIC_FORMULAS: ClassicFormula[] = [
  { id: 'einstein', latex: 'E = mc^2' },
  { id: 'quadratic', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { id: 'pythagorean', latex: 'a^2 + b^2 = c^2' },
  { id: 'euler', latex: 'e^{i\\pi} + 1 = 0' },
  {
    id: 'binomial',
    latex: '(a + b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k',
  },
  {
    id: 'taylor',
    latex: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x - a)^n',
  },
  {
    id: 'gaussian',
    latex: '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,\\mathrm{d}x = \\sqrt{\\pi}',
  },
  {
    id: 'cauchySchwarz',
    latex: '|\\langle u, v \\rangle|^2 \\leq \\|u\\|^2 \\|v\\|^2',
  },
  {
    id: 'bayes',
    latex: 'P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}',
  },
  {
    id: 'derivative',
    latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}",
  },
  {
    id: 'fourier',
    latex: '\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\,e^{-2\\pi i x\\xi}\\,\\mathrm{d}x',
  },
  {
    id: 'navierStokes',
    latex:
      '\\rho\\left(\\frac{\\partial \\mathbf{v}}{\\partial t} + \\mathbf{v}\\cdot\\nabla\\mathbf{v}\\right) = -\\nabla p + \\mu\\nabla^2\\mathbf{v} + \\mathbf{f}',
  },
  {
    id: 'maxwell',
    latex: '\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}',
  },
  {
    id: 'schrodinger',
    latex: 'i\\hbar\\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi',
  },
  {
    id: 'normalDist',
    latex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}}\\,e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}',
  },
  {
    id: 'matrix2x2Det',
    latex: '\\det\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} = ad - bc',
  },
];

export function getLatexCategory(id: string): LatexCategory | undefined {
  return LATEX_CATEGORIES.find((c) => c.id === id);
}

export function getClassicFormula(id: string): ClassicFormula | undefined {
  return CLASSIC_FORMULAS.find((f) => f.id === id);
}

/** 组合符号 tooltip：说明 + LaTeX */
export function formatSnippetTooltip(item: LatexSnippet, lang: string): string {
  const desc = lang.toLowerCase().startsWith('zh') ? item.hintZh : item.hintEn;
  return `${desc}\n${item.latex}`;
}

/** 插入片段后光标宜落在首个空 `{}` 内 */
export function preferredCursorOffset(snippet: string): number {
  const idx = snippet.indexOf('{}');
  if (idx >= 0) return idx + 1;
  return snippet.length;
}

export function insertAtCursor(
  value: string,
  start: number,
  end: number,
  insert: string,
): { value: string; cursor: number } {
  const s = Math.max(0, Math.min(start, value.length));
  const e = Math.max(s, Math.min(end, value.length));
  const next = value.slice(0, s) + insert + value.slice(e);
  return { value: next, cursor: s + preferredCursorOffset(insert) };
}

export type LatexExportFormat = 'png' | 'jpg' | 'svg';

export function isLatexExportFormat(v: string): v is LatexExportFormat {
  return v === 'png' || v === 'jpg' || v === 'svg';
}

export const LATEX_CATEGORY_IDS = LATEX_CATEGORIES.map((c) => c.id);

export function isLatexCategoryId(v: string): v is LatexCategory['id'] {
  return LATEX_CATEGORIES.some((c) => c.id === v);
}
