/**
 * plan_cuentas.js — Gestión del Plan de Cuentas contables
 * KeysCITI — Control de Facturas
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'keysciti_plan_cuentas';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Default plan de cuentas (PYME Chile) ---------- */
  var DEFAULT_ACCOUNTS = [
    // 1 - ACTIVO
    { code:'1', name:'ACTIVO', level:1, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:false, parent:'' },
    { code:'1.1', name:'ACTIVO CORRIENTE', level:2, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:false, parent:'1' },
    { code:'1.1.01', name:'Efectivo y Equivalentes', level:3, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:false, parent:'1.1' },
    { code:'1.1.01.01', name:'Caja General', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.01' },
    { code:'1.1.01.02', name:'Caja Chica / Fondo Fijo', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.01' },
    { code:'1.1.01.03', name:'Banco Principal Moneda Nacional', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.01' },
    { code:'1.1.01.04', name:'Banco Moneda Extranjera', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.01' },
    { code:'1.1.01.05', name:'Depósitos a Plazo / Inversiones CP', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.01' },
    { code:'1.1.02', name:'Deudores Comerciales y Otras CxC', level:3, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:false, parent:'1.1' },
    { code:'1.1.02.01', name:'Clientes Nacionales', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.02' },
    { code:'1.1.02.02', name:'Clientes Extranjeros', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.02' },
    { code:'1.1.02.03', name:'Documentos y Cheques por Cobrar', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.02' },
    { code:'1.1.02.04', name:'Deudores Varios', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.02' },
    { code:'1.1.02.05', name:'( - ) Estimación Ctas Incobrables', level:4, class:'1', nat:'Acreedora', clasif:'Activo Corriente', imp:true, parent:'1.1.02' },
    { code:'1.1.03', name:'CxC Partes Relacionadas', level:3, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:false, parent:'1.1' },
    { code:'1.1.03.01', name:'CxC Socios / Accionistas', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.03' },
    { code:'1.1.03.02', name:'CxC Empresas Relacionadas', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.03' },
    { code:'1.1.04', name:'Inventarios / Existencias', level:3, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:false, parent:'1.1' },
    { code:'1.1.04.01', name:'Mercaderías / Productos Terminados', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.04' },
    { code:'1.1.04.02', name:'Productos en Proceso', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.04' },
    { code:'1.1.04.03', name:'Materias Primas y Materiales', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.04' },
    { code:'1.1.04.04', name:'Repuestos y Suministros', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.04' },
    { code:'1.1.04.05', name:'( - ) Provisión Obsolescencia Inventario', level:4, class:'1', nat:'Acreedora', clasif:'Activo Corriente', imp:true, parent:'1.1.04' },
    { code:'1.1.05', name:'Activos por Impuestos Corrientes', level:3, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:false, parent:'1.1' },
    { code:'1.1.05.01', name:'Remanente Crédito Fiscal IVA', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.05' },
    { code:'1.1.05.02', name:'Pagos Provisorios Mensuales (PPM)', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.05' },
    { code:'1.1.05.03', name:'Retenciones de Impuesto a Favor', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.05' },
    { code:'1.1.06', name:'Gastos Pagados por Adelantado', level:3, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:false, parent:'1.1' },
    { code:'1.1.06.01', name:'Seguros Pagados por Adelantado', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.06' },
    { code:'1.1.06.02', name:'Arriendos Pagados por Adelantado', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.06' },
    { code:'1.1.06.03', name:'Anticipos a Proveedores', level:4, class:'1', nat:'Deudora', clasif:'Activo Corriente', imp:true, parent:'1.1.06' },
    { code:'1.2', name:'ACTIVO NO CORRIENTE', level:2, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:false, parent:'1' },
    { code:'1.2.01', name:'Propiedad, Planta y Equipo', level:3, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:false, parent:'1.2' },
    { code:'1.2.01.01', name:'Terrenos', level:4, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:true, parent:'1.2.01' },
    { code:'1.2.01.02', name:'Edificios y Construcciones', level:4, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:true, parent:'1.2.01' },
    { code:'1.2.01.03', name:'Maquinarias y Equipos de Trabajo', level:4, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:true, parent:'1.2.01' },
    { code:'1.2.01.04', name:'Vehículos y Flota de Transporte', level:4, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:true, parent:'1.2.01' },
    { code:'1.2.01.05', name:'Muebles y Útiles de Oficina', level:4, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:true, parent:'1.2.01' },
    { code:'1.2.01.06', name:'Equipos Computacionales y Tecnología', level:4, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:true, parent:'1.2.01' },
    { code:'1.2.02', name:'Depreciación Acumulada', level:3, class:'1', nat:'Acreedora', clasif:'Activo No Corriente', imp:false, parent:'1.2' },
    { code:'1.2.02.01', name:'( - ) Dep. Acum. Edificios', level:4, class:'1', nat:'Acreedora', clasif:'Activo No Corriente', imp:true, parent:'1.2.02' },
    { code:'1.2.02.02', name:'( - ) Dep. Acum. Maquinarias', level:4, class:'1', nat:'Acreedora', clasif:'Activo No Corriente', imp:true, parent:'1.2.02' },
    { code:'1.2.02.03', name:'( - ) Dep. Acum. Vehículos', level:4, class:'1', nat:'Acreedora', clasif:'Activo No Corriente', imp:true, parent:'1.2.02' },
    { code:'1.2.02.04', name:'( - ) Dep. Acum. Equipos Comput.', level:4, class:'1', nat:'Acreedora', clasif:'Activo No Corriente', imp:true, parent:'1.2.02' },
    { code:'1.2.03', name:'Activos Intangibles', level:3, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:false, parent:'1.2' },
    { code:'1.2.03.01', name:'Marcas y Patentes Comercial', level:4, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:true, parent:'1.2.03' },
    { code:'1.2.03.02', name:'Licencias de Software y Software Propio', level:4, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:true, parent:'1.2.03' },
    { code:'1.2.03.03', name:'( - ) Amortización Acum. Intangibles', level:4, class:'1', nat:'Acreedora', clasif:'Activo No Corriente', imp:true, parent:'1.2.03' },
    { code:'1.2.04', name:'Otros Activos No Corrientes', level:3, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:false, parent:'1.2' },
    { code:'1.2.04.01', name:'Inversiones de Largo Plazo', level:4, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:true, parent:'1.2.04' },
    { code:'1.2.04.02', name:'Garantías en Arriendo y Depósitos', level:4, class:'1', nat:'Deudora', clasif:'Activo No Corriente', imp:true, parent:'1.2.04' },

    // 2 - PASIVO
    { code:'2', name:'PASIVO', level:1, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:false, parent:'' },
    { code:'2.1', name:'PASIVO CORRIENTE', level:2, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:false, parent:'2' },
    { code:'2.1.01', name:'Ctas por Pagar Comerciales / Proveedores', level:3, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:false, parent:'2.1' },
    { code:'2.1.01.01', name:'Proveedores Nacionales', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.01' },
    { code:'2.1.01.02', name:'Proveedores Extranjeros / Importaciones', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.01' },
    { code:'2.1.01.03', name:'Facturas y Documentos por Pagar', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.01' },
    { code:'2.1.02', name:'Obligaciones Financieras Corto Plazo', level:3, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:false, parent:'2.1' },
    { code:'2.1.02.01', name:'Créditos Bancarios Corto Plazo', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.02' },
    { code:'2.1.02.02', name:'Líneas de Crédito Utilizadas', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.02' },
    { code:'2.1.02.03', name:'Contratos de Leasing Corto Plazo', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.02' },
    { code:'2.1.03', name:'Obligaciones con el Personal', level:3, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:false, parent:'2.1' },
    { code:'2.1.03.01', name:'Sueldos y Remuneraciones por Pagar', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.03' },
    { code:'2.1.03.02', name:'Cotizaciones Previsionales por Pagar', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.03' },
    { code:'2.1.03.03', name:'Gratificaciones y Bonos por Pagar', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.03' },
    { code:'2.1.03.04', name:'Provisión de Vacaciones del Personal', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.03' },
    { code:'2.1.04', name:'Obligaciones Tributarias y Fiscales', level:3, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:false, parent:'2.1' },
    { code:'2.1.04.01', name:'Débito Fiscal IVA por Pagar', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.04' },
    { code:'2.1.04.02', name:'Impuesto Única 2da Categoría por Pagar', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.04' },
    { code:'2.1.04.03', name:'Retención Impuesto Retenido por Honorarios', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.04' },
    { code:'2.1.04.04', name:'Impuesto de Primera Categoría por Pagar', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.04' },
    { code:'2.1.05', name:'Otras Ctas por Pagar y Provisiones CP', level:3, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:false, parent:'2.1' },
    { code:'2.1.05.01', name:'Acreedores Varios Corto Plazo', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.05' },
    { code:'2.1.05.02', name:'Anticipos de Clientes', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.05' },
    { code:'2.1.05.03', name:'Dividendos / Retiros por Pagar', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.05' },
    { code:'2.1.05.04', name:'Provisiones para Gastos Operativos', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo Corriente', imp:true, parent:'2.1.05' },
    { code:'2.2', name:'PASIVO NO CORRIENTE', level:2, class:'2', nat:'Acreedora', clasif:'Pasivo No Corriente', imp:false, parent:'2' },
    { code:'2.2.01', name:'Obligaciones Financieras Largo Plazo', level:3, class:'2', nat:'Acreedora', clasif:'Pasivo No Corriente', imp:false, parent:'2.2' },
    { code:'2.2.01.01', name:'Créditos Hipotecarios', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo No Corriente', imp:true, parent:'2.2.01' },
    { code:'2.2.01.02', name:'Préstamos Bancarios Largo Plazo', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo No Corriente', imp:true, parent:'2.2.01' },
    { code:'2.2.01.03', name:'Contratos de Leasing Largo Plazo', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo No Corriente', imp:true, parent:'2.2.01' },
    { code:'2.2.02', name:'Ctas por Pagar Partes Relacionadas LP', level:3, class:'2', nat:'Acreedora', clasif:'Pasivo No Corriente', imp:false, parent:'2.2' },
    { code:'2.2.02.01', name:'Préstamos de Socios / Accionistas', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo No Corriente', imp:true, parent:'2.2.02' },
    { code:'2.2.02.02', name:'Ctas por Pagar a Empresas Relacionadas', level:4, class:'2', nat:'Acreedora', clasif:'Pasivo No Corriente', imp:true, parent:'2.2.02' },

    // 3 - PATRIMONIO NETO
    { code:'3', name:'PATRIMONIO NETO', level:1, class:'3', nat:'Acreedora', clasif:'Patrimonio Neto', imp:false, parent:'' },
    { code:'3.1', name:'PATRIMONIO', level:2, class:'3', nat:'Acreedora', clasif:'Patrimonio Neto', imp:false, parent:'3' },
    { code:'3.1.01', name:'Capital Social', level:3, class:'3', nat:'Acreedora', clasif:'Patrimonio Neto', imp:false, parent:'3.1' },
    { code:'3.1.01.01', name:'Capital Pagado / Aportado', level:4, class:'3', nat:'Acreedora', clasif:'Patrimonio Neto', imp:true, parent:'3.1.01' },
    { code:'3.1.01.02', name:'Capital por Integrar', level:4, class:'3', nat:'Deudora', clasif:'Patrimonio Neto', imp:true, parent:'3.1.01' },
    { code:'3.1.02', name:'Reservas', level:3, class:'3', nat:'Acreedora', clasif:'Patrimonio Neto', imp:false, parent:'3.1' },
    { code:'3.1.02.01', name:'Reserva Legal', level:4, class:'3', nat:'Acreedora', clasif:'Patrimonio Neto', imp:true, parent:'3.1.02' },
    { code:'3.1.02.02', name:'Otras Reservas / Estatutarias', level:4, class:'3', nat:'Acreedora', clasif:'Patrimonio Neto', imp:true, parent:'3.1.02' },
    { code:'3.1.03', name:'Resultados Acumulados', level:3, class:'3', nat:'Acreedora', clasif:'Patrimonio Neto', imp:false, parent:'3.1' },
    { code:'3.1.03.01', name:'Utilidades Acum. Ejercicios Anteriores', level:4, class:'3', nat:'Acreedora', clasif:'Patrimonio Neto', imp:true, parent:'3.1.03' },
    { code:'3.1.03.02', name:'( - ) Pérdidas Acum. Ejercicios Anteriores', level:4, class:'3', nat:'Deudora', clasif:'Patrimonio Neto', imp:true, parent:'3.1.03' },
    { code:'3.1.04', name:'Resultado del Ejercicio', level:3, class:'3', nat:'Acreedora', clasif:'Patrimonio Neto', imp:false, parent:'3.1' },
    { code:'3.1.04.01', name:'Utilidad (o Pérdida) del Ejercicio Actual', level:4, class:'3', nat:'Acreedora', clasif:'Patrimonio Neto', imp:true, parent:'3.1.04' },

    // 4 - INGRESOS OPERACIONALES
    { code:'4', name:'INGRESOS OPERACIONALES', level:1, class:'4', nat:'Acreedora', clasif:'Ingresos Operacionales', imp:false, parent:'' },
    { code:'4.1', name:'INGRESOS POR ACTIVIDADES ORDINARIAS', level:2, class:'4', nat:'Acreedora', clasif:'Ingresos Operacionales', imp:false, parent:'4' },
    { code:'4.1.01', name:'Ventas de Productos y Mercaderías', level:3, class:'4', nat:'Acreedora', clasif:'Ingresos Operacionales', imp:false, parent:'4.1' },
    { code:'4.1.01.01', name:'Ventas Nacionales de Productos', level:4, class:'4', nat:'Acreedora', clasif:'Ingresos Operacionales', imp:true, parent:'4.1.01' },
    { code:'4.1.01.02', name:'Ventas de Exportación', level:4, class:'4', nat:'Acreedora', clasif:'Ingresos Operacionales', imp:true, parent:'4.1.01' },
    { code:'4.1.02', name:'Prestación de Servicios', level:3, class:'4', nat:'Acreedora', clasif:'Ingresos Operacionales', imp:false, parent:'4.1' },
    { code:'4.1.02.01', name:'Ingresos por Servicios Profesionales', level:4, class:'4', nat:'Acreedora', clasif:'Ingresos Operacionales', imp:true, parent:'4.1.02' },
    { code:'4.1.02.02', name:'Ingresos por Contratos de Mantenimiento', level:4, class:'4', nat:'Acreedora', clasif:'Ingresos Operacionales', imp:true, parent:'4.1.02' },
    { code:'4.1.02.03', name:'Ingresos por Proyectos e Instalaciones', level:4, class:'4', nat:'Acreedora', clasif:'Ingresos Operacionales', imp:true, parent:'4.1.02' },
    { code:'4.1.03', name:'Devoluciones y Descuentos sobre Ventas', level:3, class:'4', nat:'Deudora', clasif:'Ingresos Operacionales', imp:false, parent:'4.1' },
    { code:'4.1.03.01', name:'( - ) Devoluciones en Ventas', level:4, class:'4', nat:'Deudora', clasif:'Ingresos Operacionales', imp:true, parent:'4.1.03' },
    { code:'4.1.03.02', name:'( - ) Descuentos Comerciales Otorgados', level:4, class:'4', nat:'Deudora', clasif:'Ingresos Operacionales', imp:true, parent:'4.1.03' },

    // 5 - COSTO DE VENTAS Y OPERACIÓN
    { code:'5', name:'COSTO DE VENTAS Y OPERACIÓN', level:1, class:'5', nat:'Deudora', clasif:'Costo de Ventas', imp:false, parent:'' },
    { code:'5.1', name:'COSTOS DIRECTOS DE EXPLOTACIÓN', level:2, class:'5', nat:'Deudora', clasif:'Costo de Ventas', imp:false, parent:'5' },
    { code:'5.1.01', name:'Costo de Ventas Mercaderías', level:3, class:'5', nat:'Deudora', clasif:'Costo de Ventas', imp:false, parent:'5.1' },
    { code:'5.1.01.01', name:'Costo de Compra de Productos Vendidos', level:4, class:'5', nat:'Deudora', clasif:'Costo de Ventas', imp:true, parent:'5.1.01' },
    { code:'5.1.01.02', name:'Fletes y Gastos de Importación Directos', level:4, class:'5', nat:'Deudora', clasif:'Costo de Ventas', imp:true, parent:'5.1.01' },
    { code:'5.1.02', name:'Costo de Servicios Prestados', level:3, class:'5', nat:'Deudora', clasif:'Costo de Ventas', imp:false, parent:'5.1' },
    { code:'5.1.02.01', name:'Remuneraciones Directas y Mano de Obra', level:4, class:'5', nat:'Deudora', clasif:'Costo de Ventas', imp:true, parent:'5.1.02' },
    { code:'5.1.02.02', name:'Subcontratos y Servicios Externos Directos', level:4, class:'5', nat:'Deudora', clasif:'Costo de Ventas', imp:true, parent:'5.1.02' },
    { code:'5.1.02.03', name:'Insumos y Materiales Directos para Servicios', level:4, class:'5', nat:'Deudora', clasif:'Costo de Ventas', imp:true, parent:'5.1.02' },
    { code:'5.1.02.04', name:'Depreciación de Equipos Operativos', level:4, class:'5', nat:'Deudora', clasif:'Costo de Ventas', imp:true, parent:'5.1.02' },

    // 6 - GASTOS OPERACIONALES
    { code:'6', name:'GASTOS OPERACIONALES', level:1, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:false, parent:'' },
    { code:'6.1', name:'GASTOS DE ADMINISTRACIÓN', level:2, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:false, parent:'6' },
    { code:'6.1.01', name:'Gastos de Personal Administrativo', level:3, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:false, parent:'6.1' },
    { code:'6.1.01.01', name:'Sueldos y Salarios Personal de Administración', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:true, parent:'6.1.01' },
    { code:'6.1.01.02', name:'Leyes Sociales y Aportes Patronales', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:true, parent:'6.1.01' },
    { code:'6.1.01.03', name:'Capacitación y Bienestar del Personal', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:true, parent:'6.1.01' },
    { code:'6.1.02', name:'Servicios Básicos y Arriendos', level:3, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:false, parent:'6.1' },
    { code:'6.1.02.01', name:'Arriendo de Oficinas y Locales', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:true, parent:'6.1.02' },
    { code:'6.1.02.02', name:'Electricidad, Agua y Gas', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:true, parent:'6.1.02' },
    { code:'6.1.02.03', name:'Telecomunicaciones e Internet', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:true, parent:'6.1.02' },
    { code:'6.1.03', name:'Honorarios y Servicios Profesionales', level:3, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:false, parent:'6.1' },
    { code:'6.1.03.01', name:'Honorarios Contables y Auditoría', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:true, parent:'6.1.03' },
    { code:'6.1.03.02', name:'Asesorías Legales y Técnicas', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:true, parent:'6.1.03' },
    { code:'6.1.03.03', name:'Servicios Informáticos y Software Cloud', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:true, parent:'6.1.03' },
    { code:'6.1.04', name:'Gastos Generales de Oficina', level:3, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:false, parent:'6.1' },
    { code:'6.1.04.01', name:'Artículos de Oficina y Aseo', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:true, parent:'6.1.04' },
    { code:'6.1.04.02', name:'Seguros Generales de Oficina', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:true, parent:'6.1.04' },
    { code:'6.1.04.03', name:'Reparaciones y Mantenimiento de Oficina', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:true, parent:'6.1.04' },
    { code:'6.1.04.04', name:'Depreciación Activos Fijos Administrativos', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Administración', imp:true, parent:'6.1.04' },
    { code:'6.2', name:'GASTOS DE VENTAS Y MARKETING', level:2, class:'6', nat:'Deudora', clasif:'Gastos de Ventas', imp:false, parent:'6' },
    { code:'6.2.01', name:'Remuneraciones y Comisiones de Ventas', level:3, class:'6', nat:'Deudora', clasif:'Gastos de Ventas', imp:false, parent:'6.2' },
    { code:'6.2.01.01', name:'Sueldos Equipo Comercial', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Ventas', imp:true, parent:'6.2.01' },
    { code:'6.2.01.02', name:'Comisiones e Incentivos por Ventas', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Ventas', imp:true, parent:'6.2.01' },
    { code:'6.2.02', name:'Marketing y Publicidad', level:3, class:'6', nat:'Deudora', clasif:'Gastos de Ventas', imp:false, parent:'6.2' },
    { code:'6.2.02.01', name:'Publicidad Digital (Google, Meta, LinkedIn)', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Ventas', imp:true, parent:'6.2.02' },
    { code:'6.2.02.02', name:'Imprenta, Merchandising y Materiales', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Ventas', imp:true, parent:'6.2.02' },
    { code:'6.2.02.03', name:'Gastos de Representación y Viajes Comerciales', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Ventas', imp:true, parent:'6.2.02' },
    { code:'6.2.03', name:'Logística y Distribución de Ventas', level:3, class:'6', nat:'Deudora', clasif:'Gastos de Ventas', imp:false, parent:'6.2' },
    { code:'6.2.03.01', name:'Fletes y Despachos a Clientes', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Ventas', imp:true, parent:'6.2.03' },
    { code:'6.2.03.02', name:'Embalajes y Materiales de Despacho', level:4, class:'6', nat:'Deudora', clasif:'Gastos de Ventas', imp:true, parent:'6.2.03' },

    // 7 - RESULTADO NO OPERACIONAL Y FINANCIERO
    { code:'7', name:'RESULTADO NO OPERACIONAL Y FINANCIERO', level:1, class:'7', nat:'Variable', clasif:'Resultado No Operacional', imp:false, parent:'' },
    { code:'7.1', name:'INGRESOS NO OPERACIONALES Y FINANCIEROS', level:2, class:'7', nat:'Acreedora', clasif:'Resultado No Operacional', imp:false, parent:'7' },
    { code:'7.1.01', name:'Ingresos Financieros', level:3, class:'7', nat:'Acreedora', clasif:'Resultado No Operacional', imp:false, parent:'7.1' },
    { code:'7.1.01.01', name:'Intereses Ganados por Depósitos y Cuentas', level:4, class:'7', nat:'Acreedora', clasif:'Resultado No Operacional', imp:true, parent:'7.1.01' },
    { code:'7.1.01.02', name:'Ganancia por Diferencia de Cambio', level:4, class:'7', nat:'Acreedora', clasif:'Resultado No Operacional', imp:true, parent:'7.1.01' },
    { code:'7.1.01.03', name:'Reajustes y Corrección Monetaria Positiva', level:4, class:'7', nat:'Acreedora', clasif:'Resultado No Operacional', imp:true, parent:'7.1.01' },
    { code:'7.1.02', name:'Otros Ingresos Fuera de Explotación', level:3, class:'7', nat:'Acreedora', clasif:'Resultado No Operacional', imp:false, parent:'7.1' },
    { code:'7.1.02.01', name:'Ganancia en Venta de Activos Fijos', level:4, class:'7', nat:'Acreedora', clasif:'Resultado No Operacional', imp:true, parent:'7.1.02' },
    { code:'7.1.02.02', name:'Subsidios y Aportes Estatales / Fomento', level:4, class:'7', nat:'Acreedora', clasif:'Resultado No Operacional', imp:true, parent:'7.1.02' },
    { code:'7.1.02.03', name:'Otros Ingresos Extraordinarios', level:4, class:'7', nat:'Acreedora', clasif:'Resultado No Operacional', imp:true, parent:'7.1.02' },
    { code:'7.2', name:'GASTOS NO OPERACIONALES Y FINANCIEROS', level:2, class:'7', nat:'Deudora', clasif:'Resultado No Operacional', imp:false, parent:'7' },
    { code:'7.2.01', name:'Gastos Financieros', level:3, class:'7', nat:'Deudora', clasif:'Resultado No Operacional', imp:false, parent:'7.2' },
    { code:'7.2.01.01', name:'Intereses Bancarios y Financieros', level:4, class:'7', nat:'Deudora', clasif:'Resultado No Operacional', imp:true, parent:'7.2.01' },
    { code:'7.2.01.02', name:'Comisiones Bancarias y Mantención de Cuentas', level:4, class:'7', nat:'Deudora', clasif:'Resultado No Operacional', imp:true, parent:'7.2.01' },
    { code:'7.2.01.03', name:'Pérdida por Diferencia de Cambio', level:4, class:'7', nat:'Deudora', clasif:'Resultado No Operacional', imp:true, parent:'7.2.01' },
    { code:'7.2.02', name:'Otros Gastos Fuera de Explotación', level:3, class:'7', nat:'Deudora', clasif:'Resultado No Operacional', imp:false, parent:'7.2' },
    { code:'7.2.02.01', name:'Pérdida en Venta / Retiro de Activos Fijos', level:4, class:'7', nat:'Deudora', clasif:'Resultado No Operacional', imp:true, parent:'7.2.02' },
    { code:'7.2.02.02', name:'Gastos No Deducibles e Intereses Penales', level:4, class:'7', nat:'Deudora', clasif:'Resultado No Operacional', imp:true, parent:'7.2.02' },
    { code:'7.3', name:'IMPUESTO A LA RENTA', level:2, class:'7', nat:'Deudora', clasif:'Impuesto a la Renta', imp:false, parent:'7' },
    { code:'7.3.01', name:'Impuesto a las Ganancias', level:3, class:'7', nat:'Deudora', clasif:'Impuesto a la Renta', imp:false, parent:'7.3' },
    { code:'7.3.01.01', name:'Gasto por Impuesto de Primera Categoría', level:4, class:'7', nat:'Deudora', clasif:'Impuesto a la Renta', imp:true, parent:'7.3.01' }
  ];

  var CLASS_NAMES = {
    '1': 'Activo', '2': 'Pasivo', '3': 'Patrimonio Neto',
    '4': 'Ingresos', '5': 'Costo de Ventas', '6': 'Gastos', '7': 'Resultado No Op.'
  };

  /* ---------- State ---------- */
  var accounts = [];
  var selectedCode = null;
  var editingCode = null;
  var deleteTargetCode = null;
  var expandedNodes = {};

  /* ---------- Persistence — API REST ---------- */
  var API_BASE = (window.__USER__ && window.__USER__.apiBase) || 'php/api/';

  function apiFetch(endpoint, options) {
    options = options || {};
    options.credentials = 'same-origin';
    if (!options.headers) options.headers = {};
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    return fetch(API_BASE + endpoint, options).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Error del servidor');
        return data;
      });
    });
  }

  function loadAccounts(callback) {
    apiFetch('cuentas.php').then(function (data) {
      accounts = data.cuentas || [];
      if (callback) callback();
    }).catch(function () {
      accounts = JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS));
      if (callback) callback();
    });
  }

  function saveAccountToServer(account, callback, errCb) {
    if (account.id) {
      // Actualizar
      apiFetch('cuentas.php', { method: 'PUT', body: account })
        .then(function () { if (callback) callback(); })
        .catch(function (e) { if (errCb) errCb(e); });
    } else {
      // Crear
      apiFetch('cuentas.php', { method: 'POST', body: account })
        .then(function (data) { if (callback) callback(data.id); })
        .catch(function (e) { if (errCb) errCb(e); });
    }
  }

  function deleteAccountFromServer(id, callback, errCb) {
    apiFetch('cuentas.php', { method: 'DELETE', body: { id: id } })
      .then(function () { if (callback) callback(); })
      .catch(function (e) { if (errCb) errCb(e); });
  }

  /* ---------- Helpers ---------- */
  function getChildren(code) {
    return accounts.filter(function (a) { return a.parent === code; });
  }
  function hasChildren(code) {
    return accounts.some(function (a) { return a.parent === code; });
  }
  function findByCode(code) {
    return accounts.find(function (a) { return a.code === code; });
  }
  function getRootAccounts() {
    return accounts.filter(function (a) { return !a.parent; });
  }
  function getAncestors(code) {
    var parts = code.split('.');
    var ancestors = [];
    for (var i = 1; i < parts.length; i++) {
      ancestors.push(parts.slice(0, i).join('.'));
    }
    return ancestors;
  }

  /* ---------- Summary ---------- */
  function renderSummary() {
    var el = $('pc-summary');
    if (!el) return;
    var counts = {};
    accounts.forEach(function (a) {
      counts[a.class] = (counts[a.class] || 0) + 1;
    });
    var totalImp = accounts.filter(function (a) { return a.imp; }).length;
    var html = '<span class="pc-chip"><strong>' + accounts.length + '</strong> cuentas totales</span>';
    html += '<span class="pc-chip"><strong>' + totalImp + '</strong> imputables</span>';
    for (var c = 1; c <= 7; c++) {
      if (counts[c]) {
        html += '<span class="pc-chip" data-class="' + c + '">'
          + '<span class="pc-chip-dot"></span>'
          + CLASS_NAMES[c] + ': ' + counts[c]
          + '</span>';
      }
    }
    el.innerHTML = html;
  }

  /* ---------- Tree rendering ---------- */
  function renderTree(filterText, filterClass) {
    var treeEl = $('pc-tree');
    if (!treeEl) return;

    var ft = (filterText || '').toLowerCase();
    var fc = filterClass || '';

    // Build filtered set
    var visibleCodes = {};
    accounts.forEach(function (a) {
      var matchText = !ft || a.code.toLowerCase().indexOf(ft) > -1 || a.name.toLowerCase().indexOf(ft) > -1;
      var matchClass = !fc || a.class === fc;
      if (matchText && matchClass) {
        visibleCodes[a.code] = true;
        // Also show ancestors
        getAncestors(a.code).forEach(function (anc) { visibleCodes[anc] = true; });
      }
    });

    var roots = getRootAccounts().filter(function (a) { return visibleCodes[a.code]; });
    if (roots.length === 0) {
      treeEl.innerHTML = '<div class="pc-empty">'
        + '<svg viewBox="0 0 24 24" width="48" height="48"><path fill="currentColor" d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>'
        + '<p>No se encontraron cuentas</p>'
        + '<p class="pc-empty-sub">Intenta con otros filtros o crea una nueva cuenta.</p>'
        + '</div>';
      return;
    }

    var html = '';
    roots.forEach(function (root) {
      html += renderNode(root, visibleCodes, ft, fc);
    });
    treeEl.innerHTML = html;

    // Restore expanded state
    Object.keys(expandedNodes).forEach(function (code) {
      var childrenEl = treeEl.querySelector('.pc-children[data-parent="' + code + '"]');
      var toggleEl = treeEl.querySelector('.pc-toggle[data-code="' + code + '"]');
      if (childrenEl && toggleEl) {
        childrenEl.classList.remove('collapsed');
        toggleEl.textContent = '▼';
      }
    });
  }

  function renderNode(account, visibleCodes, ft, fc) {
    var children = getChildren(account.code).filter(function (a) { return visibleCodes[a.code]; });
    var isExpanded = expandedNodes[account.code] !== false;
    var isLeaf = children.length === 0;
    var isSelected = selectedCode === account.code;

    var html = '<div class="pc-node" data-code="' + account.code + '">';
    html += '<div class="pc-node-row' + (isSelected ? ' selected' : '') + '" data-code="' + account.code + '">';
    html += '<button class="pc-toggle' + (isLeaf ? ' leaf' : '') + '" data-code="' + account.code + '">'
      + (isLeaf ? '' : (isExpanded ? '▼' : '▶')) + '</button>';
    html += '<span class="pc-node-code">' + account.code + '</span>';
    html += '<span class="pc-node-name">' + escapeHtml(account.name) + '</span>';
    html += '<span class="pc-node-badges">';
    if (account.imp) html += '<span class="pc-badge pc-badge-imp">IMP</span>';
    html += '<span class="pc-badge ' + (account.nat === 'Deudora' ? 'pc-badge-deb' : account.nat === 'Acreedora' ? 'pc-badge-acre' : '') + '">'
      + (account.nat === 'Variable' ? 'VAR' : account.nat === 'Deudora' ? 'DEB' : 'ACR') + '</span>';
    html += '</span>';
    html += '<span class="pc-node-actions">';
    html += '<button class="pc-node-btn pc-edit" data-code="' + account.code + '" title="Editar">✎</button>';
    html += '<button class="pc-node-btn pc-add-child" data-code="' + account.code + '" title="Agregar subcuenta">+</button>';
    html += '<button class="pc-node-btn del pc-delete" data-code="' + account.code + '" title="Eliminar">✕</button>';
    html += '</span>';
    html += '</div>';

    if (!isLeaf) {
      html += '<div class="pc-children' + (isExpanded ? '' : ' collapsed') + '" data-parent="' + account.code + '">';
      children.forEach(function (child) {
        html += renderNode(child, visibleCodes, ft, fc);
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* ---------- Modal ---------- */
  function openModal(mode, parentCode) {
    editingCode = mode === 'edit' ? selectedCode : null;
    var modal = $('pc-modal');
    var title = $('pc-modal-title');
    var form = $('pc-form');

    if (mode === 'edit' && selectedCode) {
      var acc = findByCode(selectedCode);
      if (!acc) return;
      title.textContent = 'Editar Cuenta';
      $('pc-f-code').value = acc.code;
      $('pc-f-name').value = acc.name;
      $('pc-f-class').value = acc.class;
      $('pc-f-nat').value = acc.nat;
      $('pc-f-clasif').value = acc.clasif;
      $('pc-f-imp').checked = acc.imp;
      $('pc-f-code').disabled = true;
      populateParentSelect(acc.class, acc.code);
      $('pc-f-parent').value = acc.parent || '';
    } else {
      title.textContent = 'Nueva Cuenta';
      form.reset();
      $('pc-f-code').disabled = false;
      var defaultClass = '1';
      var defaultParent = parentCode || '';
      if (parentCode) {
        var pParent = findByCode(parentCode);
        if (pParent) {
          defaultClass = pParent.class;
          defaultParent = pParent.code;
        }
      }
      $('pc-f-class').value = defaultClass;
      populateParentSelect(defaultClass, '');
      $('pc-f-parent').value = defaultParent;
    }

    modal.hidden = false;
    $('pc-f-name').focus();
  }

  function closeModal() {
    $('pc-modal').hidden = true;
    editingCode = null;
  }

  function populateParentSelect(cls, excludeCode) {
    var sel = $('pc-f-parent');
    sel.innerHTML = '<option value="">(Nivel superior / Raíz)</option>';
    accounts
      .filter(function (a) { return a.class === cls && a.code !== excludeCode; })
      .sort(function (a, b) { return a.code.localeCompare(b.code, undefined, { numeric: true }); })
      .forEach(function (a) {
        var indent = '';
        for (var i = 1; i < a.level; i++) indent += '— ';
        var opt = document.createElement('option');
        opt.value = a.code;
        opt.textContent = indent + a.code + '  ' + a.name;
        sel.appendChild(opt);
      });
  }

  /* ---------- CRUD ---------- */
  function saveAccount() {
    var code = $('pc-f-code').value.trim();
    var name = $('pc-f-name').value.trim();
    var parent = $('pc-f-parent').value;
    var cls = $('pc-f-class').value;
    var nat = $('pc-f-nat').value;
    var clasif = $('pc-f-clasif').value;
    var imp = $('pc-f-imp').checked;

    if (!code || !name) { alert('Código y Nombre son obligatorios.'); return; }

    // Validate code format
    if (!/^[0-9]+(\.[0-9]+)*$/.test(code)) {
      alert('El código solo debe contener números y puntos (ej: 1.1.01.01).');
      return;
    }

    // Calculate level
    var level = code.split('.').length;
    if (level > 4) { alert('Máximo 4 niveles de profundidad.'); return; }

    // Check duplicate
    if (!editingCode && findByCode(code)) {
      alert('Ya existe una cuenta con el código ' + code + '.');
      return;
    }

    // Check parent exists
    if (parent) {
      var pParent = findByCode(parent);
      if (!pParent) { alert('La cuenta padre seleccionada no existe.'); return; }
      if (pParent.class !== cls) { alert('La cuenta padre debe pertenecer a la misma clase.'); return; }
    }

    // Validate parent-child relationship
    if (parent) {
      var expectedParent = '';
      var parts = code.split('.');
      if (parts.length > 1) {
        expectedParent = parts.slice(0, -1).join('.');
      }
      if (expectedParent && expectedParent !== parent) {
        if (!confirm('El código ' + code + ' sugiere padre ' + expectedParent + ', pero seleccionaste ' + parent + '. ¿Continuar?')) {
          return;
        }
      }
    }

    var accountData = {
      code: code, name: name, level: level, class: cls,
      nat: nat, clasif: clasif, imp: imp, parent: parent
    };

    if (editingCode) {
      // Find existing account by code to get its id
      var existing = findByCode(editingCode);
      if (existing && existing.id) {
        accountData.id = existing.id;
      }
    }

    saveAccountToServer(accountData, function () {
      closeModal();
      selectedCode = code;
      expandedNodes[code] = true;
      // Expand ancestors
      getAncestors(code).forEach(function (anc) { expandedNodes[anc] = true; });
      loadAccounts(function () { refreshAll(); });
    }, function (err) {
      alert('Error al guardar: ' + (err.message || 'Error desconocido'));
    });
  }

  function deleteAccount(code) {
    var acc = findByCode(code);
    if (!acc) return;

    var children = getChildren(code);
    if (children.length > 0) {
      alert('No se puede eliminar "' + acc.name + '" porque tiene ' + children.length + ' subcuentas. Elimina primero las subcuentas.');
      return;
    }

    deleteTargetCode = code;
    $('pc-confirm-msg').textContent = '¿Eliminar la cuenta ' + code + ' — ' + acc.name + '?';
    $('pc-confirm-modal').hidden = false;
  }

  function confirmDelete() {
    if (!deleteTargetCode) return;
    var acc = findByCode(deleteTargetCode);
    if (!acc || !acc.id) return;

    deleteAccountFromServer(acc.id, function () {
      if (selectedCode === deleteTargetCode) selectedCode = null;
      deleteTargetCode = null;
      $('pc-confirm-modal').hidden = true;
      loadAccounts(function () { refreshAll(); });
    }, function (err) {
      alert('Error al eliminar: ' + (err.message || 'Error desconocido'));
    });
  }

  /* ---------- Refresh ---------- */
  function refreshAll() {
    renderSummary();
    renderTree($('pc-search').value, $('pc-filter-class').value);
  }

  /* ---------- Init ---------- */
  function init() {
    loadAccounts();

    // Tab navigation
    var tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var tabId = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(function (tc) {
          tc.hidden = tc.id !== 'tab-' + tabId;
        });
        if (tabId === 'plan-cuentas') refreshAll();
        if (tabId === 'libro-diario') document.dispatchEvent(new CustomEvent('libro-diario:refresh'));
        if (tabId === 'libro-mayor') document.dispatchEvent(new CustomEvent('libro-mayor:refresh'));
        if (tabId === 'dashboard') document.dispatchEvent(new CustomEvent('dashboard:refresh'));
        if (tabId === 'flujo-caja') document.dispatchEvent(new CustomEvent('flujo-caja:refresh'));
      });
    });

    // Tree events (delegated)
    var treeEl = $('pc-tree');
    if (treeEl) {
      treeEl.addEventListener('click', function (e) {
        var toggleBtn = e.target.closest('.pc-toggle');
        if (toggleBtn && !toggleBtn.classList.contains('leaf')) {
          var code = toggleBtn.getAttribute('data-code');
          expandedNodes[code] = expandedNodes[code] === false ? true : false;
          renderTree($('pc-search').value, $('pc-filter-class').value);
          return;
        }

        var editBtn = e.target.closest('.pc-edit');
        if (editBtn) {
          selectedCode = editBtn.getAttribute('data-code');
          openModal('edit');
          return;
        }

        var addChildBtn = e.target.closest('.pc-add-child');
        if (addChildBtn) {
          var parentCode = addChildBtn.getAttribute('data-code');
          expandedNodes[parentCode] = true;
          openModal('add', parentCode);
          return;
        }

        var delBtn = e.target.closest('.pc-delete');
        if (delBtn) {
          deleteAccount(delBtn.getAttribute('data-code'));
          return;
        }

        var nodeRow = e.target.closest('.pc-node-row');
        if (nodeRow) {
          var code = nodeRow.getAttribute('data-code');
          selectedCode = code;
          // Toggle expand on double-click or if has children
          if (hasChildren(code)) {
            expandedNodes[code] = expandedNodes[code] === false ? true : (expandedNodes[code] !== false ? false : true);
          }
          renderTree($('pc-search').value, $('pc-filter-class').value);
        }
      });
    }

    // Search & filter
    if ($('pc-search')) {
      $('pc-search').addEventListener('input', function () {
        renderTree(this.value, $('pc-filter-class').value);
      });
    }
    if ($('pc-filter-class')) {
      $('pc-filter-class').addEventListener('change', function () {
        renderTree($('pc-search').value, this.value);
      });
    }

    // Add button
    if ($('pc-btn-add')) {
      $('pc-btn-add').addEventListener('click', function () { openModal('add'); });
    }

    // Modal events
    if ($('pc-modal-close')) $('pc-modal-close').addEventListener('click', closeModal);
    if ($('pc-btn-cancel')) $('pc-btn-cancel').addEventListener('click', closeModal);
    if ($('pc-btn-save')) $('pc-btn-save').addEventListener('click', saveAccount);

    // Close modal on backdrop click
    var pcModal = $('pc-modal');
    if (pcModal) {
      pcModal.addEventListener('click', function (e) {
        if (e.target === pcModal) closeModal();
      });
    }

    // Delete confirmation
    if ($('pc-btn-confirm-del')) $('pc-btn-confirm-del').addEventListener('click', confirmDelete);
    document.querySelectorAll('.pc-close-confirm').forEach(function (btn) {
      btn.addEventListener('click', function () { $('pc-confirm-modal').hidden = true; });
    });

    // Class selector sync
    if ($('pc-f-class')) {
      $('pc-f-class').addEventListener('change', function () {
        populateParentSelect(this.value, editingCode || '');
      });
    }

    // Keyboard: Escape closes modals
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('pc-modal').hidden) closeModal();
        if (!$('pc-confirm-modal').hidden) $('pc-confirm-modal').hidden = true;
      }
    });

    // Expand all by default
    accounts.forEach(function (a) {
      if (hasChildren(a.code)) expandedNodes[a.code] = true;
    });

    // Load accounts from API, then render
    loadAccounts(function () {
      // Re-expand after loading
      accounts.forEach(function (a) {
        if (hasChildren(a.code)) expandedNodes[a.code] = true;
      });
      refreshAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
