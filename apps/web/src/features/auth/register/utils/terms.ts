/**
 * The terms and conditions shown before an account is created.
 *
 * They live in this one file on purpose: the legal text is not code, it is
 * content that arrives from outside and changes on its own schedule. Replacing
 * the arrays below is the whole integration; no component needs to be touched.
 *
 * The version travels with the text and is rendered in the modal: a person who
 * accepted "version 2026-03" should be able to see which text they accepted,
 * and a later change has to look like a change.
 */
export const TERMS_VERSION = "2026-10-24";

export interface TermsSection {
	heading: string;
	body: string;
}

/**
 * The legal copy, published as it was written.
 *
 * The version below is the same date the text carries ("Última actualización"),
 * so what the modal shows and what the person accepted cannot drift apart: a new
 * revision of the text changes this string with it.
 */
export const TERMS_SECTIONS: TermsSection[] = [
	{
		heading: "1. Aceptación de los términos",
		body: "Al acceder, registrarte o usar Inventory Manager, aceptas quedar obligado por estos Términos y Condiciones. Si no estás de acuerdo con alguna parte, no debes usar la Aplicación. La Aplicación es operada por Alexis Jesus Buelvas Madera, con domicilio en Colombia / Cartagena de Indias. Última actualización: 24/10/2026. Si usas la Aplicación en nombre de una empresa u organización, declaras que tienes autoridad para obligarla a estos Términos; en ese caso, se refiere también a esa organización. Debes tener al menos 18 años, o la mayoría de edad legal en tu país si es mayor, para usar la Aplicación.",
	},
	{
		heading: "Qué datos se guardan",
		body: "Al crear una cuenta se guardan tu dirección de correo y tu nombre si lo cargás. El contenido que cargues (productos, clientes, movimientos y compras) pertenece a la empresa en la que lo registraste.",
	},
	{
		heading: "Qué podés hacer con tu cuenta",
		body: "Podés pedir la baja de tu cuenta en cualquier momento. Los datos de una empresa siguen siendo de la empresa, aunque tu usuario deje de tener acceso.",
	},
	{
		heading: "2. Definiciones",
		body: "Aplicación o Servicio: el software de gestión de inventarios, sus funciones, sitios web, interfaces y API. Usuario: toda persona o entidad que accede o usa la Aplicación. Cuenta: el perfil personal que permite acceder al Servicio. Contenido del Usuario: los datos que ingresas o cargas, como productos, existencias, precios, proveedores, movimientos, imágenes, notas y reportes. Plan Gratuito: la modalidad actual en la que el Servicio se ofrece sin costo. Plan de Pago: cualquier modalidad futura con tarifa, suscripción o funciones premium.",
	},
	{
		heading: "3. Descripción del servicio y gratuidad",
		body: "La Aplicación permite registrar, organizar y consultar inventarios: productos, cantidades, categorías, proveedores, entradas y salidas, y reportes. Actualmente el Servicio es totalmente gratuito. El Servicio se ofrece “tal cual” y puede cambiar. Podemos agregar, modificar, limitar o retirar funciones en cualquier momento, con o sin aviso previo, especialmente mientras sea gratuito. La gratuidad no crea ningún derecho adquirido a que el Servicio permanezca gratuito, disponible o sin límites en el futuro. Podemos establecer límites razonables de uso, como número de productos, usuarios, almacenamiento o solicitudes, para proteger la estabilidad del Servicio.",
	},
	{
		heading: "4. Posibles planes de pago futuros",
		body: "Podemos introducir Planes de Pago, funciones premium o suscripciones en el futuro. Si lo hacemos: te avisaremos con una antelación razonable (por ejemplo, 30 días) por correo electrónico o dentro de la Aplicación; nunca se te cobrará sin que antes aceptes expresamente un Plan de Pago, sus precios y sus condiciones; podrás seguir usando el Plan Gratuito, con las limitaciones que se anuncien, o cancelar tu Cuenta y exportar tus datos antes de que el cambio entre en vigor; y los Planes de Pago tendrán términos adicionales sobre precios, impuestos, facturación, renovación, cancelación y reembolsos, que se sumarán a estos Términos. El uso continuado del Servicio tras el aviso, bajo las condiciones comunicadas, no implica aceptar un cobro: el pago siempre requiere tu aceptación expresa.",
	},
	{
		heading: "5. Registro y cuenta de usuario",
		body: "Para usar ciertas funciones debes crear una Cuenta con información veraz, completa y actualizada. Eres responsable de mantener la confidencialidad de tus credenciales y de toda actividad realizada con tu Cuenta. Debes avisarnos de inmediato si sospechas un uso no autorizado. Cada Cuenta es personal; no puedes venderla, cederla ni compartirla, salvo que una función de equipos lo permita expresamente. Si invitas a otras personas a tu espacio de trabajo, eres responsable de que cumplan estos Términos. No somos responsables por pérdidas derivadas del uso no autorizado de tu Cuenta cuando no hayas cumplido estas obligaciones.",
	},
	{
		heading: "6. Uso aceptable y conductas prohibidas",
		body: "Te comprometes a usar la Aplicación de forma lícita y de buena fe. Está prohibido: usar el Servicio para actividades ilegales, fraudulentas o que infrinjan derechos de terceros, incluido el comercio de bienes prohibidos; intentar acceder sin autorización a cuentas, sistemas, redes o datos de otros usuarios; introducir virus, código malicioso o cualquier elemento que dañe o sobrecargue el Servicio; realizar ingeniería inversa, descompilar, copiar o extraer el código fuente, salvo que la ley lo permita expresamente; usar bots, scraping o medios automatizados no autorizados, o saturar la infraestructura; revender, sublicenciar o explotar comercialmente el Servicio sin nuestra autorización escrita; cargar contenido que infrinja derechos de propiedad intelectual, sea difamatorio o viole la privacidad de otras personas; y eludir límites técnicos, de seguridad o de uso del Servicio. Podemos investigar incumplimientos y tomar medidas, incluida la suspensión de la Cuenta, y cooperar con las autoridades cuando la ley lo exija.",
	},
	{
		heading: "7. Contenido y datos del usuario",
		body: "Titularidad. Tú conservas todos los derechos sobre tu Contenido del Usuario. No reclamamos su propiedad. Licencia limitada. Nos otorgas una licencia mundial, no exclusiva y gratuita para alojar, almacenar, procesar y mostrar tu contenido únicamente con el fin de prestarte y mejorar el Servicio, y para cumplir obligaciones legales. Tu responsabilidad. Eres el único responsable de la exactitud, legalidad y calidad de los datos que ingresas, y de contar con los derechos y permisos necesarios sobre ellos, incluidos los datos personales de clientes o proveedores que registres. Respaldo y exportación. Te recomendamos exportar y respaldar tus datos periódicamente. Podrás solicitar o realizar la exportación de tus datos antes de cerrar tu Cuenta, cuando el Servicio lo permita. Decisiones de negocio. La Aplicación es una herramienta de apoyo. Las decisiones de compra, venta, precios, stock, contabilidad o impuestos son tuyas, y debes verificar los reportes antes de basarte en ellos.",
	},
	{
		heading: "8. Propiedad intelectual",
		body: "La Aplicación, su código, diseño, marcas, logotipos, textos, interfaces y documentación son propiedad del Titular o de sus licenciantes y están protegidos por las leyes de propiedad intelectual aplicables. Te concedemos una licencia limitada, personal, revocable, no exclusiva e intransferible para usar la Aplicación conforme a estos Términos. No se te transfiere ningún otro derecho. Si nos envías comentarios, ideas o sugerencias, podemos usarlos libremente para mejorar el Servicio, sin obligación de compensarte ni de atribuirte su autoría. La Aplicación puede incluir software de código abierto de terceros, que se rige por sus propias licencias.",
	},
	{
		heading: "9. Privacidad y protección de datos",
		body: "El tratamiento de tus datos personales se rige por nuestra Política de Privacidad [ENLACE], que forma parte de estos Términos. Tratamos solo los datos necesarios para operar, proteger y mejorar el Servicio. Aplicamos medidas de seguridad técnicas y organizativas razonables, pero ningún sistema es completamente infalible. No vendemos tus datos personales a terceros. Podemos usar proveedores de servicios (alojamiento, analítica, correo) que traten datos por nuestra cuenta bajo obligaciones de confidencialidad. Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición y portabilidad, según la ley que te aplique, escribiendo a alexjesus-4856@hotmail.com. Al ser un servicio internacional, tus datos pueden transferirse y almacenarse en países distintos al tuyo, con las salvaguardas exigidas por la ley aplicable. Si cargas datos personales de terceros (por ejemplo, clientes o proveedores), eres responsable de cumplir las leyes de protección de datos aplicables, como el RGPD en la Unión Europea, la Ley 1581 de 2012 en Colombia, la CCPA/CPRA en California u otras normas locales.",
	},
	{
		heading: "10. Disponibilidad, mantenimiento y copias de seguridad",
		body: "Procuramos que la Aplicación esté disponible de forma continua, pero no garantizamos que funcione sin interrupciones ni errores. Puede haber suspensiones por mantenimiento, actualizaciones, fallos técnicos o causas ajenas a nuestro control. Podemos realizar copias de seguridad por razones operativas, pero no garantizamos la recuperación de datos perdidos, eliminados o corrompidos. Eres responsable de conservar tus propias copias de los datos importantes. No ofrecemos acuerdos de nivel de servicio (SLA) mientras el Servicio sea gratuito, salvo que se indique lo contrario por escrito.",
	},
	{
		heading: "11. Exención de garantías",
		body: "En la medida máxima permitida por la ley, la Aplicación se ofrece “TAL CUAL” y “SEGÚN DISPONIBILIDAD”, sin garantías de ningún tipo, expresas o implícitas, incluidas las de comerciabilidad, idoneidad para un fin particular, exactitud, no infracción y funcionamiento ininterrumpido o libre de errores. No garantizamos que los reportes, cálculos de existencias o valoraciones generados por la Aplicación sean exactos o aptos para fines contables, fiscales, legales o regulatorios. Algunas jurisdicciones no permiten excluir ciertas garantías; en ese caso, la exclusión se aplicará hasta donde la ley lo permita.",
	},
	{
		heading: "12. Limitación de responsabilidad",
		body: "En la medida máxima permitida por la ley, ni el Titular ni sus colaboradores, proveedores o afiliados serán responsables por daños indirectos, incidentales, especiales, consecuentes o punitivos, ni por pérdida de beneficios, ingresos, datos, clientela, oportunidades de negocio o interrupciones de actividad, derivados del uso o la imposibilidad de usar la Aplicación, aunque se nos haya advertido de esa posibilidad. Mientras el Servicio sea gratuito, nuestra responsabilidad total acumulada frente a ti por cualquier reclamación relacionada con la Aplicación no excederá [USD 100]. Si contratas un Plan de Pago, el límite será el importe que hayas pagado en los 12 meses anteriores al hecho que originó la reclamación. Nada en estos Términos excluye ni limita la responsabilidad que no pueda excluirse conforme a la ley aplicable, como la derivada de dolo, culpa grave, fraude o los derechos irrenunciables de los consumidores.",
	},
	{
		heading: "13. Indemnización",
		body: "Aceptas mantener indemne al Titular, a sus colaboradores y afiliados frente a reclamaciones, daños, pérdidas, costos y gastos (incluidos honorarios razonables de abogados) derivados de: tu incumplimiento de estos Términos; tu Contenido del Usuario; tu violación de derechos de terceros o de la ley aplicable. Esta cláusula se aplica en la medida permitida por la ley y no se aplicará a consumidores cuando la normativa local lo prohíba.",
	},
	{
		heading: "14. Suspensión y terminación",
		body: "Por tu parte. Puedes dejar de usar el Servicio y cerrar tu Cuenta en cualquier momento. Por nuestra parte. Podemos suspender o cancelar tu acceso, con o sin aviso previo, si incumples estos Términos, si hay riesgo de seguridad o de uso fraudulento, si lo exige la ley, o si decidimos discontinuar el Servicio. Cuando sea razonable, intentaremos avisarte con antelación para que puedas exportar tus datos. Efectos. Al terminar, cesa tu derecho de uso. Podremos conservar o eliminar tus datos conforme a nuestra Política de Privacidad y a las obligaciones legales. Las cláusulas que por su naturaleza deban sobrevivir (propiedad intelectual, exención de garantías, limitación de responsabilidad, indemnización y ley aplicable) seguirán vigentes.",
	},
	{
		heading: "15. Uso internacional, cumplimiento y exportación",
		body: "La Aplicación puede usarse desde distintos países, pero no declaramos que sea apropiada o esté disponible en todas las jurisdicciones. Quien accede desde fuera de [PAÍS DEL TITULAR] lo hace por iniciativa propia y es responsable de cumplir las leyes locales aplicables. Sanciones y exportación: no puedes usar el Servicio si estás sujeto a sanciones económicas o restricciones de exportación aplicables, ni desde territorios sujetos a embargo. Impuestos: eres responsable de los impuestos, tasas y obligaciones fiscales que se deriven de tu uso, incluido el que corresponda a futuros Planes de Pago. Idioma: estos Términos pueden traducirse a otros idiomas por comodidad; en caso de discrepancia prevalece la versión en [español / inglés]. Consumidores: si eres consumidor, te amparan los derechos imperativos de tu país de residencia, que no se ven afectados por estos Términos.",
	},
	{
		heading: "16. Ley aplicable y resolución de controversias",
		body: "Estos Términos se rigen por las leyes de [PAÍS], sin tener en cuenta sus normas sobre conflicto de leyes. Antes de iniciar cualquier acción, las partes intentarán resolver la controversia de buena fe escribiendo a alexjesus-4856@hotmail.com y esperando 30 días para una solución amistosa. Si no se resuelve, las controversias se someterán a los tribunales competentes de Cartagena, Colombia, según se decida. Esto no limita los derechos que la ley de tu país de residencia te otorgue como consumidor, incluido el derecho a acudir a los tribunales o autoridades de consumo de tu domicilio.",
	},
	{
		heading: "17. Modificaciones de los términos",
		body: "Podemos actualizar estos Términos en cualquier momento. Publicaremos la versión vigente con su fecha de actualización y, si el cambio es sustancial, te avisaremos por correo o dentro de la Aplicación con una antelación razonable. Si continúas usando el Servicio después de que los cambios entren en vigor, se entenderá que los aceptas. Si no estás de acuerdo, debes dejar de usarlo y cerrar tu Cuenta.",
	},
	{
		heading: "18. Disposiciones generales",
		body: "Acuerdo completo: estos Términos y la Política de Privacidad constituyen el acuerdo íntegro entre tú y el Titular sobre el Servicio. Divisibilidad: si alguna disposición se declara inválida o inaplicable, las demás seguirán vigentes. No renuncia: no ejercer un derecho no implica renunciar a él. Cesión: no puedes ceder estos Términos sin nuestro consentimiento escrito; nosotros podemos cederlos en caso de fusión, adquisición o venta de activos. Fuerza mayor: no seremos responsables por incumplimientos causados por hechos fuera de nuestro control razonable, como fallos de internet, desastres naturales, ciberataques o decisiones de autoridades. Relación entre las partes: estos Términos no crean sociedad, agencia ni relación laboral entre tú y el Titular. Comunicaciones electrónicas: aceptas recibir avisos y notificaciones por medios electrónicos.",
	},
	{
		heading: "19. Contacto",
		body: "Si tienes preguntas sobre estos Términos, escríbenos a: Correo: alexjesus-4856@hotmail.com. Sitio web: [URL]. Titular: Alexis Jesus Buelvas Madera. Dirección: Dg 20 #50-12, Cartagena de Indias, Colombia.",
	},
];

/** Shown first in the modal, above the sections: what the person is accepting. */
export const TERMS_INTRO =
	"Antes de crear la cuenta, leé y aceptá las condiciones de uso.";
