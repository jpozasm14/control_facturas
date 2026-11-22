(function () {
  'use strict';

  var STORAGE_KEY = 'keysciti_facturas';
  var API_BASE = (window.__USER__ && window.__USER__.apiBase) || 'php/api/';

  var els = {};
  var currentImage = null;       // File/Blob actual
  var currentText = null;        // Texto OCR
  var currentPreview = null;     // DataURL para preview
  var currentDocuments = [];     // Documentos encontrados en un PDF
  var editingId = null;          // ID del registro que se está editando (null = nuevo)
  var currentDocIndex = 0;       // Índice del documento seleccionado
  var currentPreviews = [];      // Previews de cada página

  // ---------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------

  function $(id) { return document.getElementById(id); }

  function fmtMoney(v) {
    if (v === null || v === undefined || v === '') return '$0';
    var n = Number(v);
    if (isNaN(n)) return '$0';
    return '$' + n.toLocaleString('es-CL');
  }

  function moneyText(v) {
    if (v === null || v === undefined || v === '') return '';
    var n = Number(v);
    if (isNaN(n)) return String(v);
    return n.toLocaleString('es-CL');
  }

  // Parsea un monto con formato chileno/mixto -> número
  // "1.234.567" -> 1234567 ; "1.234,56" -> 1234.56 ; "$ 12.300" -> 12300
  function parseMoney(s) {
    if (!s) return null;
    var str = String(s).trim();
    var m = str.match(/[\d.]+(?:,\d{1,2})?/);
    if (!m) return null;
    var raw = m[0];
    var num;
    if (raw.indexOf('.') > -1 && raw.indexOf(',') > -1) {
      num = raw.replace(/\./g, '').replace(/,/g, '.');
      num = Number(num);
    } else if (raw.indexOf(',') > -1) {
      num = Number(raw.replace(/\./g, '').replace(/,/g, '.'));
    } else {
      num = Number(raw.replace(/\./g, ''));
    }
    if (isNaN(num)) return null;
    // Si parece ser un valor sin centavos, redondear a entero
    if (num % 1 !== 0 && String(num).split('.')[1].length <= 2) {
      if (num !== Math.trunc(num)) {
        // mantener decimales solo si viene con coma explícita
      }
    }
    return num;
  }

  // ---------------------------------------------------------------
  // Matching de descripción → cuenta contable
  // ---------------------------------------------------------------

  // Palabras clave → código de cuenta (solo cuentas imputables nivel 4)
  var ACCOUNT_KEYWORDS = [
    // 6.1 Gastos de Administración
    { keys: ['arriendo','arriendos','leasing','contrato de arriendo','renta'], code:'6.1.02.01' },
    { keys: ['electricidad','agua','gas','utilities','luz','boleta de servicio'], code:'6.1.02.02' },
    { keys: ['telefonia','telecomunicacion','telefonica','internet','fibra','wifi','chip','movil','telefono','celular','datos moviles'], code:'6.1.02.03' },
    { keys: ['honorarios','contable','contabilidad','auditoria','contador','certificacion'], code:'6.1.03.01' },
    { keys: ['legal','abogado','asesoria juridica','notaria','juridico','abogada'], code:'6.1.03.02' },
    { keys: ['software','licencia','licencias','sistema','informatico','cloud','servidor','hosting','dominio','tecnologia','computador','notebook','pc','monitor','impresora','periferico','teclado','mouse','disco','usb','cable','router','switch','desarrollo','soporte','mantencion de sistemas','consultoria informatica','programacion','aplicacion','digital','data','datos','servicio informatico','infraestructura'], code:'6.1.03.03' },
    { keys: ['oficina','papel','lapiz','boligrafo','archivador','carpeta','sellos','tinta','cartuchos','articulos de aseo','aseo','limpieza','jumbo','easy','sodimac','ferreteria','mobiliario','escritorio','silla','archivo','material de oficina'], code:'6.1.04.01' },
    { keys: ['seguro','seguros','poliza','póliza'], code:'6.1.04.02' },
    { keys: ['reparacion','mantenimiento','reparaciones','mantencion','conservacion','servicio tecnico'], code:'6.1.04.03' },
    { keys: ['calefactor','secador','towel','electric','electrico','baño','acondicionado','aire acondicionado','deshumidificador','ventilador','estufa'], code:'6.1.04.03' },
    // 4.1.02 Ingresos por Servicios (ventas de servicios KeysCITI)
    { keys: ['consultoria','asesoria','asesoría','servicio','servicios','proyecto','proyectos','implementacion','instalacion','capacitacion','entrenamiento','acompañamiento','gestion','coordinacion','dirección','direccion'], code:'4.1.02.01' },
    { keys: ['desarrollo de software','aplicacion web','aplicacion movil','app','plataforma','sistema informatico','desarrollo web','programacion web'], code:'4.1.02.03' },
    { keys: ['mantenimiento preventivo','mantenimiento correctivo','soporte tecnico','soporte informatico','help desk','mesa de ayuda'], code:'4.1.02.02' },
    // 4.1.01 Ingresos por Ventas de productos
    { keys: ['producto','equipo','dispositivo','computador','notebook','monitor','impresora','periferico'], code:'4.1.01.01' },
    // 5 Costo de Ventas
    { keys: ['compra de productos','mercaderia','mercaderias','producto terminado'], code:'5.1.01.01' },
    { keys: ['flete importacion','gasto de importacion','aduana'], code:'5.1.01.02' },
    { keys: ['mano de obra','remuneracion directa','operario'], code:'5.1.02.01' },
    { keys: ['subcontrato','subcontratacion','servicio externo','contratista'], code:'5.1.02.02' },
    { keys: ['insumo','insumos','material directo','materia prima'], code:'5.1.02.03' },
    { keys: ['maquinaria','equipo operativo','equipo de trabajo'], code:'5.1.02.04' },
    // 6.2 Gastos de Ventas
    { keys: ['publicidad','marketing','google ads','facebook','meta','instagram','linkedin','campana','campania','seo','sem','ppc'], code:'6.2.02.01' },
    { keys: ['imprenta','flyer','volante','merchandising','banner','roll up','material publicitario','impresion'], code:'6.2.02.02' },
    { keys: ['viaje','pasaje','avion','hotel','hospedaje','representacion','comercial','vehiculo','bencina','combustible','estacionamiento','peaje','taxonomy'], code:'6.2.02.03' },
    { keys: ['flete','fletes','despacho','despachos','envio','envios','logistica','courier','chilexpress','starken','motopartner','despacho a domicilio'], code:'6.2.03.01' },
    { keys: ['embalaje','embalajes','caja','cajas','papel de burbuja','packing','film','plastico'], code:'6.2.03.02' },
    // 7.2 Resultado No Operacional (Gastos)
    { keys: ['interes','intereses','banco','financiamiento','creditos','credito'], code:'7.2.01.01' },
    { keys: ['comision bancaria','mantencion de cuenta','cargo bancario','comision'], code:'7.2.01.02' },
  ];

  // Cuenta por defecto según tipo de operación (cuando no hay match de keywords)
  var DEFAULT_ACCOUNT = {
    'Venta':  '4.1.02.01',  // Ingresos por Servicios Profesionales
    'Compra': '6.1.04.01',  // Artículos de Oficina y Aseo (fallback genérico)
  };

  function matchAccount(descripcion) {
    if (!descripcion) return null;
    var text = descripcion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (var i = 0; i < ACCOUNT_KEYWORDS.length; i++) {
      var entry = ACCOUNT_KEYWORDS[i];
      for (var j = 0; j < entry.keys.length; j++) {
        var kw = entry.keys[j];
        // Para keywords cortas (<=4 chars), usar word boundary para evitar falsos positivos
        if (kw.length <= 4) {
          var regex = new RegExp('(?:^|\\s|[,;.])' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|\\s|[,;.]|s)', 'i');
          if (regex.test(text)) return entry.code;
        } else {
          if (text.indexOf(kw) !== -1) return entry.code;
        }
      }
    }
    return null;
  }

  function populateAccountSelect(selectEl) {
    apiFetch('cuentas.php').then(function (data) {
      var accounts = data.cuentas || [];
      var imputables = accounts.filter(function(a) { return a.imp; });
      imputables.sort(function(a,b) { return a.code.localeCompare(b.code); });
      selectEl.innerHTML = '<option value="">— Seleccionar cuenta —</option>';
      imputables.forEach(function(a) {
        var opt = document.createElement('option');
        opt.value = a.code;
        opt.textContent = a.code + ' — ' + a.name;
        selectEl.appendChild(opt);
      });
    }).catch(function () {
      selectEl.innerHTML = '<option value="">— Seleccionar cuenta —</option>';
    });
  }

  function updateAccountMatch() {
    var desc = els.fDescripcion.value.trim();
    var code = matchAccount(desc);
    var tipoOp = els.fTipoOp ? els.fTipoOp.value : 'Venta';
    var matchInfo = document.getElementById('account-match-info');
    var noMatchInfo = document.getElementById('no-match-info');
    var matchSuggestion = document.getElementById('match-suggestion');
    if (code) {
      apiFetch('cuentas.php').then(function (data) {
        var accounts = data.cuentas || [];
        var found = accounts.filter(function(a) { return a.code === code; })[0];
        var label = found ? (code + ' — ' + found.name) : code;
        matchSuggestion.textContent = label;
        matchInfo.hidden = false;
        noMatchInfo.hidden = true;
        els.fCuenta.value = code;
      }).catch(function () {
        matchSuggestion.textContent = code;
        matchInfo.hidden = false;
        noMatchInfo.hidden = true;
        els.fCuenta.value = code;
      });
    } else {
      // Sin match exacto: usar cuenta por defecto según tipo de operación
      var defaultCode = DEFAULT_ACCOUNT[tipoOp] || DEFAULT_ACCOUNT['Compra'];
      els.fCuenta.value = defaultCode;
      matchInfo.hidden = true;
      noMatchInfo.hidden = false;
      var noMatchEl = document.getElementById('match-suggestion');
      if (noMatchEl) noMatchEl.textContent = defaultCode + ' (asignada por defecto)';
    }
  }

  function normalizeText(t) {
    return String(t)
      .replace(/\r/g, '')
      .replace(/[\u2013\u2014\u2015\u2012]/g, '')
      .replace(/[º°]/g, 'o')
      .replace(/[“”"]/g, '"')
      .replace(/[|·•]/g, ' ')
      // conserva saltos de linea (\n) para el parser por lineas
      .replace(/[ \t]+/g, ' ')
      .replace(/[ \t]*\n+/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  // ---------------------------------------------------------------
  // Parser de factura a partir del texto OCR (formato chileno)
  // ---------------------------------------------------------------

  function parseInvoice(text) {
    if (!text) return null;
    var norm = '\n' + normalizeText(text) + '\n';
    var lines = norm.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);

    // Debug: log normalized text for scanned PDFs
    console.log('[parseInvoice] text length:', text.length, '| lines:', lines.length);
    console.log('[parseInvoice] normalized text:\n' + norm);

    var data = {
      numero: null,
      fecha: null,
      neto: null,
      iva: null,
      total: null,
      descripcion: null,
      tipoDocumento: 'Factura',
      tipoOperacion: 'Venta'
    };

    // ---------- Detección de tipo de documento ----------
    var isVoucher = /(?:VENTA[\s\-]*(?:COPIA)|TRANSBANK|TARJETA\s+DE\s+CREDITO|AUTORIZACION|VALIDO\s+COMO\s+BOLETA|MONTO\s+VENTA)/i.test(norm);
    var isBoleta = !isVoucher && /(?:BOLETA|BO\.)\s*(?:E\s*)?(?:N[Oo°]?|Nº|Nro)?/i.test(norm);
    var isFactura = !isVoucher && !isBoleta && /(?:FACTURA(?:\s+(?:ELECTR[OÓ]NICA|E))?\s*(?:N[Oo°]?|Nº|Nro)?)/i.test(norm);
    var isRecibo = !isVoucher && /(?:RECIBO|COMPROBANTE\s+DE\s+PAGO)/i.test(norm);
    var isNC = /(?:NOTA\s+DE\s+CREDITO|NOTA\s+CREDITO|\bNC\b)/i.test(norm);

    // Asignar tipo detectado
    if (isNC) { data.tipoDocumento = 'Nota de crédito'; }
    else if (isVoucher) { data.tipoDocumento = 'Boleta'; }
    else if (isBoleta) { data.tipoDocumento = 'Boleta'; }
    else if (isFactura) { data.tipoDocumento = 'Factura'; }
    else if (isRecibo) { data.tipoDocumento = 'Comprobante de Pago'; }

    // Detectar operación: determinar si KeysCITI es emisor (venta) o receptor (compra)
    // RUT KeysCITI con varios formatos OCR: 77.861.478-2, 77861478-2, 77 861 478-2
    var keysRut = /77[\.\s]?861[\.\s]?478[\-\s]?2/i;
    // "KEYS CITI", "KEYSCITI", "KEYS  CITI" (OCR puede poner espacios extra)
    var keysName = /KEYS[\s]*CITI/i;
    var linesArr = lines;

    // Buscar la línea del FACTURA/BOLETA/COMPROBANTE para dividir emisor vs receptor
    var docHeaderLine = linesArr.length;
    for (var dh = 0; dh < linesArr.length; dh++) {
      if (/(?:FACTURA|BOLETA|COMPROBANTE|RECIBO|INVOICE)/i.test(linesArr[dh])) {
        docHeaderLine = dh; break;
      }
    }

    // Emisor = antes de FACTURA: buscar KEYSCITI o su RUT
    var isEmisor = false;
    for (var ei = 0; ei < docHeaderLine; ei++) {
      if (keysName.test(linesArr[ei]) || keysRut.test(linesArr[ei])) {
        isEmisor = true; break;
      }
    }

    // Receptor = buscar KEYSCITI después de SEÑOR/RECEPTOR/RUT Receptor/RUT Recep./BILLED TO/DESTINATARIO
    var isReceptor = false;
    for (var ri = 0; ri < linesArr.length; ri++) {
      var lri = linesArr[ri];
      // Detectar línea con etiqueta de receptor: SEÑOR, RECEPTOR, RUT Receptor, BILLED TO, etc.
      var hasReceptorLabel = /(?:SE[ÑN]OR|RECEPTOR|RECEP\.|BILLED\s+TO|DESTINATARIO)/i.test(lri)
        || /(?:RUT\s+(?:Receptor|Recep\.|Receptor\s*:))/i.test(lri)
        || /(?:RUT\s+(?:del\s+)?(?:Comprador|Cliente))/i.test(lri);
      if (!hasReceptorLabel) continue;

      // Verificar si KEYSCITI aparece en esta línea o en las siguientes (hasta 3)
      if (keysName.test(lri) || keysRut.test(lri)) {
        isReceptor = true; break;
      }
      for (var rj = ri + 1; rj < Math.min(ri + 4, linesArr.length); rj++) {
        if (keysName.test(linesArr[rj]) || keysRut.test(linesArr[rj])) {
          isReceptor = true; break;
        }
      }
      if (isReceptor) break;
    }

    // También detectar RUT solo (sin etiqueta) después de FACTURA → probablemente receptor
    if (!isReceptor && !isEmisor) {
      for (var ri2 = docHeaderLine; ri2 < linesArr.length; ri2++) {
        if (keysRut.test(linesArr[ri2]) || keysName.test(linesArr[ri2])) {
          isReceptor = true; break;
        }
      }
    }

    // Vouchers de tarjeta son siempre compra
    if (isVoucher) { data.tipoOperacion = 'Compra'; }
    else if (isReceptor && !isEmisor) { data.tipoOperacion = 'Compra'; }
    else if (isEmisor && !isReceptor) { data.tipoOperacion = 'Venta'; }
    // Si está en ambos (KEYSCITI aparece en emisor Y receptor), es venta (es la factura que emite)
    else if (isEmisor && isReceptor) { data.tipoOperacion = 'Venta'; }

    // ---------- Número de documento ----------
    var numMatch = null;
    if (isVoucher) {
      // Voucher: folio/boleta "AJO..." o numero de operacion/autorizacion
      var vn1 = norm.match(/(?:AJO)[\-_\s]*(\d{6,15})/i);
      if (vn1) { data.numero = vn1[1]; }
      else {
        var vn2 = norm.match(/(?:OPERACI[OÓ]N\s*[:.\-]?\s*)(\d{4,15})/i);
        if (vn2) { data.numero = vn2[1]; }
        else {
          var vn3 = norm.match(/(?:AUTORIZACION\s*[:.\-]?\s*)(\d{4,15})/i);
          if (vn3) { data.numero = vn3[1]; }
          else {
            // fallback: el folio suele estar en la misma línea de la fecha
            for (var f = 0; f < lines.length; f++) {
              if (/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/.test(lines[f])) {
                var folio = lines[f].match(/(\d{6,15})/);
                if (folio) { data.numero = folio[1]; break; }
              }
            }
          }
        }
      }
    } else if (isBoleta || isFactura || isRecibo) {
      // Patrones comunes: "N° 1234", "N ° 388", "Nº6041", "FOLIO: 1234"
      var numPatterns = [
        /(?:BOLETA(?:\s+E)?\s*(?:N[Oo°0]\s*|Nº\s*|N\s+°\s*|N\s+°\s*|N\s*))(\d{1,15})/i,
        /(?:FACTURA(?:\s+(?:ELECTR[OÓ]NICA|E))?\s*(?:N[Oo°0]\s*|Nº\s*|N\s+°\s*|N\s*))(\d{1,15})/i,
        /(?:FOLIO\s*[:.\-]?\s*)(\d{1,15})/i,
        /(?:N[Oo°0]\s*|Nº\s*|N\s+°\s*|N[oO0]\.\s*)[:.\-]?\s*(\d{1,15})/i,
        /(?:N[Uu][Mm][Ee][Rr][Oo]\s*(?:DE\s*)?(?:BOLETA|FACTURA)\s*[:.\-]?\s*)(\d{1,15})/i,
        /(?:BOLETA\s+(?:DE\s+)?(?:HONORARIOS|RECIB[OÓ]|RICIB))\s*(?:N[Oo°]?\s*|Nº?\s*|N\s+°?\s*)(\d{1,15})/i,
        /(?:RECIBO\s+(?:DE\s+)?(?:PAGO)?)\s*N?\s*(\d{1,15})/i,
        /(?:Nro|N[ºo°])\s*[:.\-]?\s*(\d{4,15})/i,
        // Patrón flexible: buscar "N°" o "No" o "Ne" (OCR) seguido de dígitos cortos (1-3) en cualquier parte
        /(?:\bN[Oo°0]?\s*\.?\s*)(\d{1,3})\b/i,
        // Cuando "FACTURA" y el número están en líneas separadas con texto intermedio
        /(?:FACTURA(?:\s+(?:ELECTR[OÓ]NICA|E))?)\s+[\s\S]{0,40}?\bN[Oo°0]?\s*\.?\s*(\d{1,15})\b/i,
        // OCR lee "N°" como "Ne" — buscar N seguido de letra no-dígito y luego dígitos
        /\bN(?:e|o|a)\s*(\d{1,6})\b/i
      ];
      for (var pi = 0; pi < numPatterns.length; pi++) {
        numMatch = norm.match(numPatterns[pi]);
        if (numMatch) { data.numero = numMatch[1]; break; }
      }
      // fallback: número en las primeras líneas que contengan FACTURA/BOLETA
      if (!data.numero) {
        for (var i = 0; i < lines.length && i < 8; i++) {
          if (/(?:BOLETA|FACTURA|RECIBO|COMPROBANTE)/i.test(lines[i])) {
            // Buscar "N°", "Nº", "No." seguido de dígitos en esa línea
            var inlineNum = lines[i].match(/(?:N[Oo°0]\s*|Nº\s*|N[oO0]\.\s*)[:.\-]?\s*(\d{1,15})/i);
            if (inlineNum) { data.numero = inlineNum[1]; break; }
            // Buscar en líneas siguientes (hasta 3) por si "N°8" está separado
            for (var ni = 1; ni <= 3 && i + ni < lines.length; ni++) {
              var nextLine = lines[i + ni].trim();
              var nextNum = nextLine.match(/(?:\bN[Oo°0]?\s*\.?\s*|Ne\s*)(\d{1,15})\b/i);
              if (nextNum && nextNum[1].length <= 6) { data.numero = nextNum[1]; break; }
            }
            if (data.numero) break;
            // Si no, buscar cualquier número, pero evitar teléfonos y RUTs
            var cand = lines[i].match(/(\d{4,15})/);
            if (cand) {
              var cn = cand[1];
              if (/^569\d{8,9}$/.test(cn)) continue;
              if (/^9\d{8}$/.test(cn)) continue;
              if (/^[2]\d{7,8}$/.test(cn)) continue;
              data.numero = cn; break;
            }
          }
        }
      }
      // último recurso: primer número del documento (evitar teléfonos, RUTs, fechas)
      if (!data.numero) {
        for (var j = 0; j < lines.length && j < 10; j++) {
          // Saltar líneas que son RUTs (XX.XXX.XXX-X)
          if (/R\.?\s*U\.?\s*T\.?\s*[:.\-]?\s*\d/i.test(lines[j])) continue;
          var fallback = lines[j].match(/(\d{1,15})/);
          if (fallback && !/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]/.test(lines[j])) {
            var fn = fallback[1];
            // Evitar teléfonos chilenos
            if (/^569\d{8,9}$/.test(fn)) continue;
            if (/^9\d{8}$/.test(fn)) continue;
            if (/^[2]\d{7,8}$/.test(fn)) continue;
            // Evitar RUTs
            if (/^\d{1,2}\.\d{3}\.\d{3}[\-]\d$/.test(lines[j])) continue;
            if (/^\d{7,8}[\-]\d$/.test(fn)) continue;
            data.numero = fn; break;
          }
        }
      }
    } else {
      // Genérico: "FACTURA ELECTRONICA N° 1234" o "FOLIO: 1234" o "N° 123456789"
      var numPatterns = [
        /(?:FACTURA(?:\s+ELECTRONICA)?\s*(?:N[Oo°]\s*|Nº\s*)(?:FOLIO\s*[:.\-]?\s*)?)(\d{1,15})/i,
        /(?:FOLIO\s*[:.\-]?\s*)(\d{1,15})/i,
        /(?:N[Oo°]\s*|Nº|N[oO]\.)\s*[:.\-]?\s*(\d{1,15})/i,
        /(?:N[Uu][Mm][Ee][Rr][Oo]\s*(?:DE\s*)?FACTURA\s*[:.\-]?\s*)(\d{1,15})/i
      ];
      for (var pi2 = 0; pi2 < numPatterns.length; pi2++) {
        numMatch = norm.match(numPatterns[pi2]);
        if (numMatch) { data.numero = numMatch[1]; break; }
      }
      if (!data.numero) {
        for (var i2 = 0; i2 < lines.length && i2 < 6; i2++) {
          if (/FACTURA/i.test(lines[i2])) {
            var cand2 = lines[i2].match(/(\d{6,15})/);
            if (cand2) { data.numero = cand2[1]; break; }
          }
        }
      }
    }

    // ---------- Fecha ----------
    // Formato dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
    var fechaMatch = norm.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
    if (fechaMatch) {
      var parts = fechaMatch[1].split(/[\/\-\.]/);
      if (parts.length === 3) {
        var dd = parts[0], mm = parts[1], yyyy = parts[2];
        if (yyyy.length === 2) yyyy = '20' + yyyy;
        if (parseInt(dd, 10) >= 1 && parseInt(dd, 10) <= 31 &&
            parseInt(mm, 10) >= 1 && parseInt(mm, 10) <= 12 &&
            parseInt(yyyy, 10) >= 2000 && parseInt(yyyy, 10) <= 2100) {
          data.fecha = ('0' + dd).slice(-2) + '/' + ('0' + mm).slice(-2) + '/' + yyyy;
        }
      }
    }
    // Formato "dd de MES del yyyy" / "dd de MES de yyyy" / "dd MES yyyy"
    if (!data.fecha) {
      var meses = { 'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
                    'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12' };
      var fechaWords = norm.match(/(\d{1,2})\s+de\s+(\w+)(?:\s+del?)?\s+(\d{4})/i);
      if (fechaWords) {
        var dayW = fechaWords[1];
        var monthW = fechaWords[2].toLowerCase();
        var yearW = fechaWords[3];
        if (meses[monthW] && parseInt(dayW, 10) >= 1 && parseInt(dayW, 10) <= 31 &&
            parseInt(yearW, 10) >= 2000 && parseInt(yearW, 10) <= 2100) {
          data.fecha = ('0' + dayW).slice(-2) + '/' + meses[monthW] + '/' + yearW;
        }
      }
    }
    // Formato "dd-mm-yyyy" en líneas como "Fecha de Emisión: 02-05-2026"
    if (!data.fecha) {
      var fechaDash = norm.match(/(?:FECHA|EMISI[OÓ]N)\s*[:.\-]?\s*(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i);
      if (fechaDash) {
        var pd = fechaDash[1].split(/[\-\/]/);
        if (pd.length === 3) {
          var dd2 = pd[0], mm2 = pd[1], yyyy2 = pd[2];
          if (yyyy2.length === 2) yyyy2 = '20' + yyyy2;
          if (parseInt(dd2, 10) >= 1 && parseInt(dd2, 10) <= 31 &&
              parseInt(mm2, 10) >= 1 && parseInt(mm2, 10) <= 12 &&
              parseInt(yyyy2, 10) >= 2000 && parseInt(yyyy2, 10) <= 2100) {
            data.fecha = ('0' + dd2).slice(-2) + '/' + ('0' + mm2).slice(-2) + '/' + yyyy2;
          }
        }
      }
    }

    // ---------- Montos: NETO / IVA / TOTAL ----------
    // Buscar etiquetas con su valor en la misma línea o en la siguiente.
    function valueAfterLine(labelRegex) {
      for (var li = 0; li < lines.length; li++) {
        if (labelRegex.test(lines[li])) {
          var rest = lines[li].replace(labelRegex, '');
          var money = parseMoney(rest);
          if (money !== null && money > 0) return money;
          for (var ahead = 1; ahead <= 8; ahead++) {
            if (li + ahead < lines.length) {
              var candidate = lines[li+ahead].trim();
              if (!candidate) continue;
              // Saltar solo "$" (OCR pone $ en línea separada)
              if (/^\$+$/.test(candidate)) continue;
              // Saltar si es solo un signo $ con espacios
              if (/^[\$]+$/.test(candidate)) continue;
              // Primero: valor monetario claro ($ con número, o número con separadores)
              if (/^\$?\s*[\d.,]+\s*$/.test(candidate) || /^\$[\d.,\s]+$/.test(candidate)) {
                money = parseMoney(candidate);
                if (money !== null && money > 0) return money;
              }
              // Saltar otras etiquetas de montos para no cruzar valores
              if (/(?:MONTO|TOTAL|NETO|IVA|I\.V\.A|DESCUENTO|EXENTO|SUB|IMPUESTO)/i.test(candidate)) continue;
              // Último intento: parsear cualquier cosa que parezca número
              if (parseMoney(candidate) !== null) {
                var m = parseMoney(candidate);
                if (m !== null && m > 0) return m;
              }
            }
          }
        }
      }
      return null;
    }

    // TOTAL (evitar TOTAL NETO como total)
    var totalMoney = valueAfterLine(/(?:^|\s)TOTAL\s*($|[\d]|\$|:)/i);
    if (totalMoney === null) {
      totalMoney = valueAfterLine(/(?:TOTAL[:\s]*)/i);
    }
    if (totalMoney === null) {
      totalMoney = valueAfterLine(/(?:TOTAL\s+A\s+PAGAR[:\s]*)/i);
    }
    if (totalMoney === null) {
      totalMoney = valueAfterLine(/(?:MONTO\s+TOTAL[:\s]*)/i);
    }
    if (totalMoney === null) {
      totalMoney = valueAfterLine(/(?:Amount\s+Due[:\s]*(?:USD)?)/i);
    }
    data.total = totalMoney;

    var netoMoney = null;
    if (isVoucher) {
      // Voucher: "MONTO VENTA: $55.765"
      netoMoney = valueAfterLine(/(?:^|\s)MONTO(?:\s+VENTA)?\s*[:.\-]?\s*\$?\s*/i);
    } else {
      // "MONTO NETO $5.672" / "Monto neto $16.680" / "NETO $5.672"
      netoMoney = valueAfterLine(/(?:^|\s)MONTO\s+NETO\s*[:.\-]?\s*\$?\s*/i);
      if (netoMoney === null) netoMoney = valueAfterLine(/(?:^|\s)Monto\s+neto\s*[:.\-]?\s*\$?\s*/i);
      if (netoMoney === null) netoMoney = valueAfterLine(/(?:^|\s)IMPORTE\s+NETO\s*[:.\-]?\s*\$?\s*/i);
      if (netoMoney === null) netoMoney = valueAfterLine(/(?:^|\s)Total\s+excl\.\s*VAT\s*[:.\-]?\s*\$?\s*/i);
      if (netoMoney === null) netoMoney = valueAfterLine(/(?:^|\s)NETO\s*($|[\d]|\$|:)/i);
      if (netoMoney === null) netoMoney = valueAfterLine(/(?:^|\s)SUB\s*TOTAL[:\s]+[\s$]*/i);
      // "LIQUIDO $: 2.300" (boletas de honorarios CBR)
      if (netoMoney === null) netoMoney = valueAfterLine(/(?:^|\s)L[IÍ]QUIDO\s*[:$\s]+\s*/i);
      if (netoMoney === null) netoMoney = valueAfterLine(/(?:^|\s)Monto\s+[Nn]eto\s*[:.\-]?\s*\$?\s*/i);
    }
    if (netoMoney === null) netoMoney = valueAfterLine(/(?:TOTAL\s*NETO[:\s]*)/i);
    // "Total Honorarios: $: 590.000" (boletas de honorarios)
    if (netoMoney === null) netoMoney = valueAfterLine(/(?:Total\s+Honorarios[:\s]*)/i);
    data.neto = netoMoney;

    // IVA: captura el monto (no el porcentaje 19%)
    // "19% I.V.A. 6.399" / "19 % I.V.A" (porcentaje antes de la etiqueta)
    var ivaMoney = valueAfterLine(/(?:^|\s)[0-9]{1,3}\s*%\s+(?:I\.\s*V\.\s*A\.?|IVA)(?:\s*[:.\-]?\s*\$?|\s*$)/i);
    // "I.V.A. 19% $1.078" / "IVA $3.169" / "IVA. 19% $ 6.275" (OCR pone punto después de IVA)
    if (ivaMoney === null) ivaMoney = valueAfterLine(/(?:^|\s)(?:IVA\.?|I\.\s*(?:V\.)?\s*A\.?\.?)\s*\(?\s*[0-9]{1,3}\s*%\)?\s*[:$]?\s*/i);
    // "IVA" solo en la línea (con o sin punto)
    if (ivaMoney === null) ivaMoney = valueAfterLine(/(?:^|\s)IVA\.?\s*[:$]+/i);
    if (ivaMoney === null) ivaMoney = valueAfterLine(/(?:^|\s)I\.\s*V\.\s*A\.?\s*[:$]+/i);
    if (ivaMoney === null) ivaMoney = valueAfterLine(/(?:^|\s)IVA\.?\s*$/i);
    if (ivaMoney === null) ivaMoney = valueAfterLine(/(?:^|\s)I\.\s*V\.\s*A\.?\s*$/i);
    // "I.V.A." solo en la línea (sin $ ni :)
    if (ivaMoney === null) ivaMoney = valueAfterLine(/(?:^|\s)I\.\s*V\.\s*A\.?\s*$/i);
    // Buscar línea con monto precedida por IVA en líneas anteriores (hasta 3 hacia atrás)
    if (ivaMoney === null) {
      for (var ivaSearch = 0; ivaSearch < lines.length; ivaSearch++) {
        if (/(?:IVA|I\.\s*V\.\s*A\.?)/i.test(lines[ivaSearch])) {
          // Buscar monto en las siguientes 2 líneas
          for (var ivaAhead = 1; ivaAhead <= 2; ivaAhead++) {
            if (ivaSearch + ivaAhead < lines.length) {
              var ivaCandidate = lines[ivaSearch + ivaAhead].trim();
              if (/^\$?\s*[\d.,]+\s*$/.test(ivaCandidate) || /^\$[\d.,\s]+$/.test(ivaCandidate)) {
                var parsed = parseMoney(ivaCandidate);
                if (parsed !== null && parsed > 0) { ivaMoney = parsed; break; }
              }
            }
          }
          if (ivaMoney !== null) break;
        }
      }
    }
    // "Impuesto Retenido: 89.975" / "Impto. Retenido: 89.975" (boletas de honorarios)
    if (ivaMoney === null) {
      ivaMoney = valueAfterLine(/(?:^|\s)(?:15\.25\s*%\s*)?(?:Impto\.?\s*(?:Retenido|Adicional)|IMPUESTO\s+(?:ADICIONAL|RETRIBUIDO))\s*[:$\s]+\s*/i);
    }
    // si el OCR lee la etiqueta IVA como "A" o "IA" (comun en vouchers termicos):
    if (ivaMoney === null && isVoucher) {
      ivaMoney = valueAfterLine(/(?:^|\s)(?:I?\s*A|IA)\s*[:$]?\s*\$?\s*/i);
    }
    data.iva = ivaMoney;

    // Cálculo de respaldo
    if ((data.neto !== null && data.iva === null && data.total !== null)) {
      data.iva = Math.round((data.total - data.neto) * 100) / 100;
    }
    if (data.neto !== null && data.iva !== null && data.total === null) {
      data.total = Math.round((data.neto + data.iva) * 100) / 100;
    }

    console.log('[parseInvoice] result:', JSON.stringify(data));

    // ---------- Descripción ----------
    if (isVoucher) {
      data.descripcion = cleanDescription(findVoucherDescription(lines));
    } else if (isBoleta || isRecibo) {
      data.descripcion = cleanDescription(findBoletaDescription(lines, norm));
    } else {
      data.descripcion = cleanDescription(findDescription(lines));
    }

    return data;
  }

  // Limpiar basura OCR de la descripción: "Descripcion Adic *", "Descripcion Adicional", etc.
  function cleanDescription(desc) {
    if (!desc) return desc;
    return desc
      // Quitar "Descripcion Adic *" y variantes
      .replace(/Descripci[oó]n\s+Adic(?:ional)?\s*[*•]?\s*/gi, '')
      .replace(/Desc\.?\s+Adic\.?\s*[*•]?\s*/gi, '')
      // Quitar "Descripcion *" o solo "*"
      .replace(/Descripci[oó]n\s*[*]\s*/gi, '')
      // Quitar asteriscos sueltos al inicio/final
      .replace(/^\s*[*•]+\s*/g, '')
      .replace(/\s*[*•]+\s*$/g, '')
      // Quitar espacios múltiples
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function findDescription(lines) {
    var stopWords = /(RUT|R\.U\.T|FOLIO|NETO|IVA|TOTAL|FECHA|DETALLE|CANTIDAD|VALOR|EMITIDA|EMISION|BOLETA|PRECIO|%Impto|%Desc|Forma de Pago|Timbre|Res\.|Verifique|S\.I\.I|IMPUESTO|RECEPTOR|GIRO|DIRECCION|COMUNA|CIUDAD|TELEFONO|EMAIL|TIPO\s+DE|FACTURA|COMPROBANTE|PAGO|CONTADO|CREDITO|DEBITO|ABONO|CONTACTO|EMPRESA|EXENTA|REGIMEN|DESPACHO|ENVIO)/i;
    var descLines = [];
    var seenItemHeader = false;

    // 1. Buscar header "Descripcion" / "Detalle" / "Glosa" y capturar líneas después
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].replace(/[|,.\-]+/g, ' ').replace(/\s+/g, ' ').trim();
      // Quitar códigos de producto: código alfanumérico con dígitos al inicio + espacio, o entre palabras
      l = l.replace(/"/g, '').replace(/^[A-Z]*[0-9][A-Z0-9]*\s/, '').replace(/\s+[A-Z0-9]{2,}[0-9][A-Z0-9]{2,}\s+/g, ' ').trim();
      if (l.length < 3) continue;

      // Detectar header de descripción (matchear con y sin acentos del OCR)
      if (/^C[oó]digo\b/i.test(l) || /^Descripci[oó]n\b/i.test(l) || /^(?:DETALLE|GLOSA|CONCEPTO|Nombre del producto)/i.test(l)) {
        seenItemHeader = true;
        continue;
      }

      // Capturar líneas descriptivas después del header
      if (seenItemHeader) {
        // Parar si llegamos a montos o headers de columna
        if (/(?:CANTIDAD|PRECIO|VALOR|%Impto|%Desc|MONTO|NETO|IVA|TOTAL|Forma)/i.test(l)) break;
        if (/^\d+\s*(?:GL|UN|KG|LT|M2|M3|PAR|BOL|CAJ|ROL|PIEZA)\s*$/i.test(l)) break;
        // Saltar líneas de metadata: observaciones, líneas/cant, subtotales
        if (/(?:OBSERVACIONES|SUBTOTAL|lineas?\s*:|Cant\s*:)/i.test(l)) break;
        // Quitar códigos de línea como DESO1 al inicio
        var cleaned = l.replace(/^[A-Z]{2,}[0-9]+\s+/, '').replace(/^\d+\s*/, '').replace(/^[\-]\s*/, '').trim();
        // Quitar cantidades, precios y montos al final (más agresivo): "1 119.990 AFECTO 119.990" → ""
        cleaned = cleaned.replace(/\s+[\d][\d.,\s]*(?:AFECTO|EXENTO|GRAVADO|DESCUENTO)?[\d.,\s]*$/, '').trim();
        if (cleaned && cleaned.length >= 3 && !stopWords.test(cleaned) && !/^\d[\d.,]+$/.test(cleaned)) {
          descLines.push(cleaned);
        }
      }
    }

    if (descLines.length > 0) {
      var joined = descLines.join(' ');
      if (joined.length > 300) joined = joined.slice(0, 300);
      return joined;
    }

    // 2. Buscar líneas descriptivas entre "Cantidad/Precio" y montos
    for (var k = 0; k < lines.length; k++) {
      var ll = lines[k].trim();
      if (/^(?:Cantidad|Precio|C[oó]digo|Valor|%Impto)/i.test(ll)) {
        // Las siguientes líneas直到 montos son descripción
        for (var m = k + 1; m < lines.length; m++) {
          var dl = lines[m].replace(/[|,.\-]+/g, ' ').replace(/\s+/g, ' ').trim();
          // Quitar códigos de producto
          dl = dl.replace(/"/g, '').replace(/^[A-Z]*[0-9][A-Z0-9]*\s/, '').replace(/\s+[A-Z0-9]{2,}[0-9][A-Z0-9]{2,}\s+/g, ' ').trim();
          if (dl.length < 3) continue;
          if (/(?:MONTO|NETO|IVA|TOTAL|Forma|Timbre|Res\.)/i.test(dl)) break;
          if (/^\d+\s*(?:GL|UN|KG|LT|M2|M3|PAR|BOL|CAJ|ROL|PIEZA)\s*$/i.test(dl)) break;
          if (/(?:OBSERVACIONES|SUBTOTAL|lineas?\s*:|Cant\s*:)/i.test(dl)) break;
          if (/^[\d.,$:\s]+$/.test(dl)) continue;
          // Quitar códigos de línea y cantidades/montos al final
          var dlClean = dl.replace(/^[A-Z]{2,}[0-9]+\s+/, '').replace(/^[\-]\s*/, '').replace(/\s+[\d][\d.,\s]*(?:AFECTO|EXENTO|GRAVADO|DESCUENTO)?[\d.,\s]*$/, '').trim();
          if (dlClean.length >= 3 && dlClean.length <= 150 && !stopWords.test(dlClean)) {
            descLines.push(dlClean);
          }
        }
        if (descLines.length > 0) break;
      }
    }

    if (descLines.length > 0) {
      var joined2 = descLines.join(' ');
      if (joined2.length > 300) joined2 = joined2.slice(0, 300);
      return joined2;
    }

    // 3. Buscar después de "Fecha Emision" hasta montos — texto descriptivo de ítems
    var afterFecha = false;
    for (var ff = 0; ff < lines.length; ff++) {
      if (/(?:FECHA|EMISI[OÓ]N)/i.test(lines[ff])) { afterFecha = true; continue; }
      if (afterFecha) {
        var fl = lines[ff].replace(/[|,.\-]+/g, ' ').replace(/\s+/g, ' ').trim();
        // Quitar códigos de producto
        fl = fl.replace(/"/g, '').replace(/^[A-Z]*[0-9][A-Z0-9]*\s/, '').replace(/\s+[A-Z0-9]{2,}[0-9][A-Z0-9]{2,}\s+/g, ' ').trim();
        if (fl.length < 3) continue;
        if (/(?:MONTO|NETO|IVA|TOTAL|SUB\s*TOTAL|Forma|Timbre)/i.test(fl)) break;
        if (/^\d+\s*(?:GL|UN|KG|LT|M2|M3|PAR|BOL|CAJ|ROL|PIEZA)\s*$/i.test(fl)) break;
        if (/^[\d.,$:\s]+$/.test(fl)) continue;
        // Quitar cantidades y montos al final
        var flClean = fl.replace(/^[\-]\s*/, '').replace(/\s+[\d][\d.,\s]*$/, '').trim();
        if (!stopWords.test(flClean) && flClean.length >= 3 && flClean.length <= 200) {
          descLines.push(flClean);
          if (descLines.length >= 3) break;
        }
      }
    }

    if (descLines.length > 0) {
      var joined3 = descLines.join(' ');
      if (joined3.length > 300) joined3 = joined3.slice(0, 300);
      return joined3;
    }

    // 4. Fallback: buscar línea descriptiva sustancial desde línea 2
    for (var j = 2; j < lines.length; j++) {
      var cand = lines[j].replace(/[|,.\-]+/g, ' ').replace(/\s+/g, ' ').trim();
      // Quitar códigos de producto
      cand = cand.replace(/"/g, '').replace(/^[A-Z]*[0-9][A-Z0-9]*\s/, '').replace(/\s+[A-Z0-9]{2,}[0-9][A-Z0-9]{2,}\s+/g, ' ').trim();
      if (cand.length >= 6 && cand.length <= 150 && !stopWords.test(cand) && !/\d{6,}/.test(cand) && !/^\d[\d.,]+$/.test(cand)) {
        return cand;
      }
    }
    return null;
  }

  // Descripción para vouchers de tarjeta (Transbank): nombre del comercio
  function findVoucherDescription(lines) {
    var desc = [];
    var capture = false;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!capture) {
        if (/VENTA/i.test(l) && /COPIA/i.test(l)) { capture = true; continue; }
        if (/TARJETA\s+DE\s+CREDITO|TARJETA\s+DEBITO/i.test(l)) { capture = true; continue; }
        continue;
      }
      if (/RUT\s*[:.]/i.test(l)) break;
      if (/BOLETA|LETA|AUTORIZACION/i.test(l)) break;
      // cortar en la fecha (fin del bloque del comercio)
      if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(l)) break;
      if (/^(?:TARJETA\s+DE\s+CREDITO|TARJETA\s+DEBITO|CREDITO|DEBITO)$/i.test(l)) continue;
      if (l.length >= 3 && !/^[\d.,$:\s]+$/.test(l)) desc.push(l);
    }
    // preferir el nombre del comercio (razon social)
    for (var j = 0; j < desc.length; j++) {
      if (/(SPA|LTDA|LIMITADA|S\.?A\.?(?:\s|$))/i.test(desc[j])) return desc[j];
    }
    // fallback: buscar razon social en todo el documento
    for (var k = 0; k < lines.length; k++) {
      if (lines[k].length >= 5 && /(SPA|LTDA|LIMITADA|S\.?A\.?(?:\s|$))/i.test(lines[k]) &&
          !/TRANSBANK|FACTURA|BOLETA|NETO|IVA|TOTAL|MONTO/i.test(lines[k])) {
        return lines[k];
      }
    }
    if (desc.length > 0) {
      var joined = desc.join('. ');
      return joined.length > 300 ? joined.slice(0, 300) : joined;
    }
    return null;
  }

  // Descripción para boletas y recibos chilenos: nombre del giro/servicio
  function findBoletaDescription(lines, norm) {
    var stopWords = /(RUT|R\.U\.T|FOLIO|NETO|IVA|TOTAL|FECHA|EMITIDA|EMISION|PAGO|BOLETA|COMPROBANTE|RECIBO)/i;
    var desc = [];

    // 1. Buscar "GIRO:" o "GIRO DEL RECEPTOR" - nombre del negocio/servicio
    for (var i = 0; i < lines.length; i++) {
      var giroMatch = lines[i].match(/(?:GIRO\s*(?:DEL\s+(?:EMISOR|RECEPTOR))?\s*[:.\-]?\s*)(.+)/i);
      if (giroMatch && giroMatch[1].trim().length >= 3) {
        return giroMatch[1].trim();
      }
    }

    // 2. Buscar "DETALLE", "DESCRIPCION", "GLOSA", "CONCEPTO", "ACTIVIDAD"
    for (var j = 0; j < lines.length; j++) {
      var detMatch = lines[j].match(/^(?:DETALLE|DESCRIPCION|GLOSA|CONCEPTO|ACTIVIDAD|SERVICIO|DESCRIP)[S]?\s*[:.\-]?\s*(.+)/i);
      if (detMatch && detMatch[1].trim().length >= 3) {
        return detMatch[1].trim();
      }
    }

    // 3. Buscar entre etiquetas y montos: líneas descriptivas entre el encabezado y los totales
    var headerEnd = false;
    for (var k = 0; k < lines.length; k++) {
      var l = lines[k];
      if (!headerEnd) {
        if (/(?:BOLETA|RECIBO|COMPROBANTE|FECHA)/i.test(l)) { headerEnd = true; }
        continue;
      }
      if (/(?:NETO|IVA|TOTAL|SUB\s*TOTAL|MONTO)/i.test(l)) break;
      if (l.length >= 5 && l.length <= 120 && !stopWords.test(l) && !/^\d+$/.test(l) && !/^[\d.,$:\s]+$/.test(l)) {
        desc.push(l);
      }
    }

    if (desc.length > 0) {
      var joined = desc.join('. ');
      return joined.length > 300 ? joined.slice(0, 300) : joined;
    }

    // 4. Fallback: primera línea descriptiva sustancial del documento
    for (var m = 0; m < Math.min(10, lines.length); m++) {
      var cand = lines[m];
      if (cand.length >= 6 && cand.length <= 120 && !stopWords.test(cand) &&
          !/^\d+$/.test(cand) && !/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]/.test(cand) &&
          !/RUT/i.test(cand)) {
        return cand;
      }
    }
    return null;
  }

  var workerPromise = null;

  // Mejora la imagen para OCR: escala de grises + auto-nivel por percentiles.
  // Usar percentiles (2%-98%) en lugar de min/max global evita "quemar" el texto
  // fino cuando la foto tiene sombras/oscuridad en bordes que sesgan el rango.
  function enhanceForOCR(canvas) {
    try {
      var ctx = canvas.getContext('2d');
      var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var d = imgData.data;
      var i, gray, lo, hi;
      var hist = new Array(256).fill(0);
      var total = d.length / 4;
      // 1) escala de grises + histograma
      for (i = 0; i < d.length; i += 4) {
        gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        d[i] = gray; d[i + 1] = gray; d[i + 2] = gray;
        if (gray >= 0) hist[gray] = (hist[gray] || 0) + 1;
      }
      // 2) percentiles p2 y p98 (ignora extremos de la foto)
      function percentile(p) {
        var cum = 0, target = p * total;
        for (var v = 0; v <= 255; v++) {
          cum += (hist[v] || 0);
          if (cum >= target) return v;
        }
        return 255;
      }
      lo = percentile(0.02);
      hi = percentile(0.98);
      var range = (hi - lo) || 1;
      // 3) estirar el contraste dentro de [p2, p98]
      for (i = 0; i < d.length; i += 4) {
        gray = (d[i] - lo) / range * 255;
        gray = Math.max(0, Math.min(255, Math.round(gray)));
        d[i] = gray; d[i + 1] = gray; d[i + 2] = gray;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      // si falla el preprocesamiento, se sigue con la imagen original
    }
  }

  // Binarización automática (método de Otsu): ideal para papel térmico con
  // texto desvanecido. Convierte la imagen a blanco y negro puro.
  function binarizeForOCR(canvas) {
    try {
      var ctx = canvas.getContext('2d');
      var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var d = imgData.data;
      var i, gray;
      var hist = new Array(256).fill(0);
      var total = d.length / 4;
      for (i = 0; i < d.length; i += 4) {
        gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        d[i] = gray; d[i + 1] = gray; d[i + 2] = gray;
        if (gray >= 0) hist[gray] = (hist[gray] || 0) + 1;
      }
      // umbral de Otsu
      var sum = 0;
      for (i = 0; i <= 255; i++) sum += i * (hist[i] || 0);
      var sumB = 0, wB = 0, maxVar = 0, threshold = 128;
      for (i = 0; i <= 255; i++) {
        wB += (hist[i] || 0);
        if (wB === 0) continue;
        var wF = total - wB;
        if (wF === 0) break;
        sumB += i * (hist[i] || 0);
        var mB = sumB / wB;
        var mF = (sum - sumB) / wF;
        var between = wB * wF * (mB - mF) * (mB - mF);
        if (between > maxVar) { maxVar = between; threshold = i; }
      }
      // aplicar: negro (texto) < umbral, blanco (fondo) >= umbral
      for (i = 0; i < d.length; i += 4) {
        gray = d[i] < threshold ? 0 : 255;
        d[i] = gray; d[i + 1] = gray; d[i + 2] = gray;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      // si falla, se sigue con la imagen sin binarizar
    }
  }

  function getWorker() {
    if (!workerPromise) {
      workerPromise = Tesseract.createWorker('spa', 1, {
        logger: function (m) {
          if (m.status === 'recognizing text' && els.progressBar) {
            var pct = Math.round((m.progress || 0) * 100);
            els.progressBar.style.width = pct + '%';
            els.ocrPct.textContent = pct + '%';
            els.ocrStatus.textContent = 'Reconociendo texto…';
          } else if (m.status === 'loading language traineddata') {
            els.ocrStatus.textContent = 'Descargando modelo de idioma…';
          } else if (m.status === 'initializing tesseract') {
            els.ocrStatus.textContent = 'Inicializando OCR…';
          }
        }
      });
      workerPromise = workerPromise.catch(function (err) {
        workerPromise = null;
        throw err;
      });
    }
    return workerPromise;
  }

  async function runOCR(blob) {
    var worker = await getWorker();
    showProgress();
    try {
      var res = await worker.recognize(blob, {}, { text: true });
      hideProgress();
      if (res && res.data) {
        currentText = res.data.text;
        return currentText;
      }
      return '';
    } catch (err) {
      hideProgress();
      var detail = typeof err === 'string'
        ? err
        : (err && err.message) ? err.message : String(err);
      throw new Error('El OCR falló: ' + detail);
    }
  }

  // ---------------------------------------------------------------
  // UI: visibilidad
  // ---------------------------------------------------------------

  function showProgress() {
    els.ocrProgress.hidden = false;
    els.progressBar.style.width = '0%';
    els.ocrPct.textContent = '0%';
    els.ocrStatus.textContent = 'Preparando imagen…';
  }

  function hideProgress() {
    els.ocrProgress.hidden = true;
  }

  function showError(msg) {
    els.ocrError.hidden = false;
    els.ocrError.textContent = msg;
  }

  function clearError() {
    els.ocrError.hidden = true;
    els.ocrError.textContent = '';
  }

  function showResult(imgDataUrl, data) {
    els.previewImg.src = imgDataUrl;
    els.fNumero.value = data.numero || '';
    els.fFecha.value = data.fecha || '';
    els.fNeto.value = data.neto !== null ? moneyText(data.neto) : '';
    els.fIva.value = data.iva !== null ? moneyText(data.iva) : '';
    els.fTotal.value = data.total !== null ? moneyText(data.total) : '';
    els.fDescripcion.value = data.descripcion || '';
    els.fTipoDoc.value = data.tipoDocumento || 'Factura';
    els.fTipoOp.value = data.tipoOperacion || 'Venta';
    updateAccountMatch();
    // Panel debug: mostrar el texto OCR crudo
    if (els.ocrDebug && els.ocrDebugText) {
      var variante = bestVariant ? '[' + bestVariant + '] ' : '';
      els.ocrDebugText.textContent = variante + (currentText || '').trim();
      els.ocrDebug.hidden = false;
    }
    els.resultSection.hidden = false;
    els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // label de la variante ganadora (realzada/original/binarizada) para debug
  var bestVariant = null;
  function setBestVariant(name) { bestVariant = name; }

  function clearResult() {
    els.resultSection.hidden = true;
    els.previewImg.removeAttribute('src');
    if (els.ocrDebug) els.ocrDebug.hidden = true;
    if (els.ocrDebugText) els.ocrDebugText.textContent = '';
    currentImage = null;
    currentText = null;
    currentPreview = null;
  }

  // ---------------------------------------------------------------
  // Procesar imagen
  // ---------------------------------------------------------------

  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(blob);
    });
  }

  function isPDF(file) {
    if (file && file.type === 'application/pdf') return true;
    if (file && file.name && /\.pdf$/i.test(file.name)) return true;
    return false;
  }

  // Separa un bloque de texto OCR en múltiples documentos individuales.
  // Detecta fronteras por etiquetas como "BOLETA", "FACTURA", "COMPROBANTE", "RECIBO".
  function splitDocuments(text) {
    if (!text) return [];
    var lines = text.split('\n');
    var docs = [];
    var current = [];
    var docBoundary = /^[\s]*(?:BOLETA(?:\s+(?:E|DE\s+VENTA|DE\s+SERVICIO|RICIB|M|GASOIL|ELECTR[OÓ]NICA))?\s|FACTURA(?:\s+(?:ELECTR[OÓ]NICA|E|DE\s+SERVICIO))?\s|COMPROBANTE\s+DE\s+PAGO|RECIBO(?:\s+DE\s+PAGO)?\s)/i;

    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim();
      if (docBoundary.test(l) && current.length > 0) {
        docs.push(current.join('\n'));
        current = [];
      }
      current.push(lines[i]);
    }
    if (current.length > 0) {
      docs.push(current.join('\n'));
    }
    return docs;
  }

  async function processPDF(file) {
    var arrayBuffer = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    var totalPages = pdf.numPages;
    var pageTexts = [];
    var previews = [];

    for (var p = 1; p <= totalPages; p++) {
      var page = await pdf.getPage(p);
      var vp = page.getViewport({ scale: 2.0 });
      var canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      var ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: vp }).promise;

      // Guardar preview de cada página
      var pageBlob = await new Promise(function (res) { canvas.toBlob(res, 'image/png'); });
      previews.push(pageBlob);

      // Intentar extraer texto embebido del PDF primero
      var textContent = await page.getTextContent();
      var embeddedText = (textContent.items || []).map(function (it) { return it.str; }).join('\n').trim();

      // Si el texto embebido es suficiente (>50 chars), usarlo directo
      if (embeddedText.length > 50) {
        pageTexts.push(embeddedText);
        continue;
      }

      // Fallback: renderizar a canvas y hacer OCR (probar 3 variantes, quedarse con la mejor)
      var blobs = [];
      var origBlob = pageBlob;
      blobs.push(origBlob);

      var enhanced = document.createElement('canvas');
      enhanced.width = canvas.width; enhanced.height = canvas.height;
      enhanced.getContext('2d').drawImage(canvas, 0, 0);
      enhanceForOCR(enhanced);
      blobs.push(await new Promise(function (res) { enhanced.toBlob(res, 'image/png'); }));

      var binCanvas = document.createElement('canvas');
      binCanvas.width = canvas.width; binCanvas.height = canvas.height;
      binCanvas.getContext('2d').drawImage(canvas, 0, 0);
      binarizeForOCR(binCanvas);
      blobs.push(await new Promise(function (res) { binCanvas.toBlob(res, 'image/png'); }));

      var bestPageText = '';
      var bestPageScore = 0;
      for (var bi = 0; bi < blobs.length; bi++) {
        var text = await runOCR(blobs[bi]);
        var data = parseInvoice(text) || {};
        var score = completenessScore(data, text);
        if (score > bestPageScore) {
          bestPageScore = score;
          bestPageText = text;
        }
        if (score >= 100) break;
      }
      pageTexts.push(bestPageText);
    }

    // Unir todo el texto y separar por documentos
    var fullText = pageTexts.join('\n');
    var docTexts = splitDocuments(fullText);

    // Si no se detectaron documentos separados, tratar todo como uno
    if (docTexts.length <= 1) {
      docTexts = [fullText];
    }

    // Parsear cada documento individualmente
    var documents = [];
    for (var d = 0; d < docTexts.length; d++) {
      var data = parseInvoice(docTexts[d]) || {};
      var score = completenessScore(data, docTexts[d]);
      documents.push({
        data: data,
        text: docTexts[d],
        score: score,
        index: d
      });
    }

    // Ordenar por score descendente (mejores primero)
    documents.sort(function (a, b) { return b.score - a.score; });

    return {
      documents: documents,
      pages: totalPages,
      previews: previews
    };
  }

  async function handleImage(blob, backupBlobs) {
    clearError();
    if (!blob) return;

    try {
      // dataURL persistente (sobrevive a recargas); no usar objeto URL
      var dataUrl = await blobToDataURL(blob);
      currentPreview = dataUrl;
      currentImage = blob;
      els.previewImg.src = dataUrl;
      els.resultSection.hidden = false;

      var best = null;
      var bestData = null;
      // Probar la imagen realzada y, si el parseo quedó incompleto, los respaldos
      var names = ['realzada', 'original', 'binarizada'];
      var candidates = [blob].concat(backupBlobs || []);
      for (var ci = 0; ci < candidates.length; ci++) {
        var text = await runOCR(candidates[ci]);
        var data = parseInvoice(text) || {};
        var score = completenessScore(data, text);
        if (!best || score > best.score) {
          best = { blob: candidates[ci], data: data, text: text, score: score, name: names[ci] || ('#' + ci) };
          bestData = data;
        }
        // con un parseo completo no hace falta seguir probando
        if (score >= 100) break;
      }
      // dejar el texto ganador en currentText para el panel debug
      currentText = best ? best.text : (currentText || '');
      setBestVariant(best ? best.name : '');
      showResult(dataUrl, bestData || {});
    } catch (err) {
      hideProgress();
      workerPromise = null; // reiniciar worker para el siguiente intento
      var detail = typeof err === 'string'
        ? err
        : (err && err.message) ? err.message : String(err);
      showError('No se pudo procesar la imagen ("' + detail + '"). Verifica tu conexión a internet la primera vez y reintenta.');
    }
  }

  async function handleFile(file) {
    clearError();
    if (!file) return;

    if (isPDF(file)) {
      // PDF: extraer texto embebido o renderizar a imagen para OCR
      try {
        showProgress('Procesando PDF…', 0);
        var result = await processPDF(file);
        hideProgress();

        if (!result || !result.documents || result.documents.length === 0) {
          showError('No se pudo extraer datos del PDF. Asegúrate de que no esté protegido con contraseña.');
          return;
        }

        currentDocuments = result.documents;
        currentPreviews = result.previews || [];
        currentImage = file;
        currentDocIndex = 0;

        // Preview: primera página
        if (currentPreviews.length > 0) {
          var dataUrl = await blobToDataURL(currentPreviews[0]);
          currentPreview = dataUrl;
          els.previewImg.src = dataUrl;
        } else {
          els.previewImg.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 130"><rect width="100" height="130" fill="%23f0f0f0" rx="8"/><text x="50" y="65" text-anchor="middle" fill="%23666" font-size="14">PDF</text><text x="50" y="85" text-anchor="middle" fill="%23999" font-size="10">' + (result.pages || 1) + ' pág</text></svg>');
        }

        els.resultSection.hidden = false;
        setBestVariant('pdf');

        // Si hay múltiples documentos, mostrar selector
        if (currentDocuments.length > 1) {
          showDocumentSelector(currentDocuments);
        } else {
          hideDocumentSelector();
        }

        // Mostrar el mejor documento (ya ordenados por score)
        selectDocument(0);
      } catch (err) {
        hideProgress();
        var detail = (err && err.message) ? err.message : String(err);
        showError('No se pudo procesar el PDF ("' + detail + '"). Verifica que no esté corrupto o protegido.');
      }
    } else if (file.type && file.type.indexOf('image') > -1) {
      handleImage(file);
    } else {
      showError('Formato no soportado. Sube una imagen (JPG, PNG, WEBP) o un PDF.');
    }
  }

  function showDocumentSelector(documents) {
    var container = $('doc-selector');
    if (!container) return;
    container.innerHTML = '';
    container.hidden = false;

    var label = document.createElement('span');
    label.className = 'doc-selector-label';
    label.textContent = documents.length + ' documentos encontrados:';
    container.appendChild(label);

    var list = document.createElement('div');
    list.className = 'doc-selector-list';

    for (var i = 0; i < documents.length; i++) {
      (function (idx) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'doc-selector-btn';
        if (idx === 0) btn.classList.add('active');

        var d = documents[idx].data;
        var numero = d.numero || 'S/N';
        var fecha = d.fecha || '';
        var total = d.total !== null ? '$' + Number(d.total).toLocaleString('es-CL') : '';
        var score = documents[idx].score;

        var title = document.createElement('span');
        title.className = 'doc-btn-title';
        title.textContent = '#' + (idx + 1) + ' — ' + numero;
        btn.appendChild(title);

        if (fecha) {
          var fech = document.createElement('span');
          fech.className = 'doc-btn-detail';
          fech.textContent = fecha;
          btn.appendChild(fech);
        }
        if (total) {
          var tot = document.createElement('span');
          tot.className = 'doc-btn-detail';
          tot.textContent = total;
          btn.appendChild(tot);
        }

        var badge = document.createElement('span');
        badge.className = 'doc-btn-score';
        badge.textContent = score + '%';
        btn.appendChild(badge);

        btn.addEventListener('click', function () {
          selectDocument(idx);
          // Actualizar active
          var btns = list.querySelectorAll('.doc-selector-btn');
          for (var b = 0; b < btns.length; b++) btns[b].classList.remove('active');
          btn.classList.add('active');
        });

        list.appendChild(btn);
      })(i);
    }

    container.appendChild(list);
  }

  function hideDocumentSelector() {
    var container = $('doc-selector');
    if (container) { container.innerHTML = ''; container.hidden = true; }
  }

  async function selectDocument(idx) {
    if (!currentDocuments[idx]) return;
    currentDocIndex = idx;
    var doc = currentDocuments[idx];

    currentText = doc.text || '';
    setBestVariant('pdf');

    // Preview: buscar la página correspondiente (asignar por orden)
    if (currentPreviews.length > 0) {
      var pageIdx = Math.min(idx, currentPreviews.length - 1);
      var dataUrl = await blobToDataURL(currentPreviews[pageIdx]);
      currentPreview = dataUrl;
      els.previewImg.src = dataUrl;
    }

    showResult(currentPreview || '', doc.data || {});
  }

  // Qué tan completo quedó un parseo (0-100). 100 = todos los campos clave.
  function completenessScore(data, text) {
    if (!data) return 0;
    var s = 0;
    // voucher: numero, neto, total, iva, descripcion son lo que importa
    var hasNumber = data.numero !== null && String(data.numero).trim() !== '';
    var hasFecha = data.fecha !== null && String(data.fecha).trim() !== '';
    var hasNeto = data.neto !== null;
    var hasIva = data.iva !== null;
    var hasTotal = data.total !== null;
    var hasDesc = data.descripcion !== null && String(data.descripcion).trim() !== '';
    if (hasNumber) s += 20;
    if (hasFecha) s += 10;
    if (hasNeto) s += 20;
    if (hasIva) s += 20;
    if (hasTotal) s += 20;
    if (hasDesc) s += 10;
    // el texto de respaldo no debe ser sospechosamente corto (OCR casi vacío)
    var cleanLen = String(text || '').replace(/\s+/g, ' ').trim().length;
    if (cleanLen < 6) s = Math.min(s, 15);
    return s;
  }

  // ---------------------------------------------------------------
  // Formateo de montos en inputs
  // ---------------------------------------------------------------

  function bindMoneyInput(input) {
    input.addEventListener('blur', function () {
      var v = input.value.trim();
      if (!v) { input.value = ''; return; }
      var num = parseMoney(v);
      input.value = num !== null ? moneyText(num) : v;
    });
  }

  // ---------------------------------------------------------------
  // Persistencia — API REST
  // ---------------------------------------------------------------

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

  function loadAll() {
    return apiFetch('facturas.php').then(function (data) {
      var list = data.facturas || [];
      // Normalizar snake_case del PHP → camelCase del JS
      list.forEach(function (r) {
        r.id = String(r.id);
        r.tipoDocumento = r.tipo_documento || r.tipoDocumento || '';
        r.tipoOperacion = r.tipo_operacion || r.tipoOperacion || '';
        r.cuentaContable = r.cuenta_contable || r.cuentaContable || '';
        r.asientoNum = r.asiento_num != null ? Number(r.asiento_num) : null;
        r.image = r.imagen || r.image || '';
      });
      return list;
    }).catch(function (err) { console.error('loadAll error:', err); return []; });
  }

  function saveFactura(f) {
    if (f.id && f._editing) {
      // Actualizar
      var payload = Object.assign({}, f);
      delete payload._editing;
      delete payload.image;
      return apiFetch('facturas.php', { method: 'PUT', body: payload });
    } else {
      // Crear
      var payload2 = Object.assign({}, f);
      delete payload2.id;
      delete payload2._editing;
      if (f.image) payload2.imagen = f.image;
      delete payload2.image;
      return apiFetch('facturas.php', { method: 'POST', body: payload2 });
    }
  }

  function deleteFactura(id) {
    return apiFetch('facturas.php', { method: 'DELETE', body: { id: id } });
  }

  // ---------------------------------------------------------------
  // Render tabla + resumen
  // ---------------------------------------------------------------

  var currentSearch = '';
  var currentPage = 0;
  var PAGE_SIZE = 10;

  function filteredList() {
    return loadAll().then(function (all) {
      var q = currentSearch ? currentSearch.toLowerCase() : '';
      var fDesde = els.filterFechaDesde ? els.filterFechaDesde.value : '';
      var fHasta = els.filterFechaHasta ? els.filterFechaHasta.value : '';
      var fTipoDoc = els.filterTipoDoc ? els.filterTipoDoc.value : '';
      var fTipoOp = els.filterTipoOp ? els.filterTipoOp.value : '';

    return all.filter(function (r) {
      // Filtro de búsqueda de texto
      if (q) {
        var match = (r.numero && r.numero.toLowerCase().indexOf(q) > -1) ||
                    (r.fecha && r.fecha.indexOf(q) > -1) ||
                    (r.descripcion && r.descripcion.toLowerCase().indexOf(q) > -1) ||
                    (r.tipoDocumento && r.tipoDocumento.toLowerCase().indexOf(q) > -1) ||
                    (r.tipoOperacion && r.tipoOperacion.toLowerCase().indexOf(q) > -1);
        if (!match) return false;
      }

      // Filtro por tipo de documento
      if (fTipoDoc && r.tipoDocumento !== fTipoDoc) return false;

      // Filtro por tipo de operación
      if (fTipoOp && r.tipoOperacion !== fTipoOp) return false;

      // Filtro por rango de fechas (formato DD/MM/AAAA en el registro, YYYY-MM-DD en input date)
      if (fDesde || fHasta) {
        var recFecha = r.fecha || '';
        // Convertir DD/MM/AAAA → AAAA-MM-DD para comparar
        var recISO = '';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(recFecha)) {
          var p = recFecha.split('/');
          recISO = p[2] + '-' + p[1] + '-' + p[0];
        }
        if (fDesde && recISO < fDesde) return false;
        if (fHasta && recISO > fHasta) return false;
      }

      return true;
    });
    });
  }

  function renderTable() {
    filteredList().then(function (list) {
      var body = els.tableBody;
      var totalItems = list.length;
      var totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
      if (currentPage >= totalPages) currentPage = totalPages - 1;
      if (currentPage < 0) currentPage = 0;
      var pageList = list.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

      if (totalItems === 0) {
        var msg = currentSearch ? 'Sin resultados para la búsqueda.' : 'Aún no hay facturas registradas. Sube tu primera factura.';
        body.innerHTML = '<tr class="row-empty"><td colspan="12">' + msg + '</td></tr>';
      } else {
        var idxBase = currentPage * PAGE_SIZE;
        body.innerHTML = pageList.map(function (r, i) {
          var idx = idxBase + i;
          return '<tr data-idx="' + idx + '">' +
            '<td>' + (idx + 1) + '</td>' +
            '<td><strong>' + esc(r.numero || '—') + '</strong></td>' +
            '<td>' + esc(r.tipoDocumento || '—') + '</td>' +
            '<td>' + esc(r.tipoOperacion || '—') + '</td>' +
            '<td class="fecha-cell">' + esc(r.fecha || '—') + '</td>' +
            '<td class="num monto-cell">' + fmtMoney(r.neto) + '</td>' +
            '<td class="num monto-cell">' + fmtMoney(r.iva) + '</td>' +
            '<td class="num monto-cell">' + fmtMoney(r.total) + '</td>' +
            '<td class="desc-cell"><p title="' + esc(r.descripcion || '') + '">' + (r.descripcion ? esc(r.descripcion) : '—') + '</p></td>' +
            '<td class="cuenta-cell">' + esc(r.cuentaContable || '—') + '</td>' +
            '<td class="asiento-cell">' + (r.asientoNum != null ? '<span class="asiento-badge" title="Ver asiento N° ' + r.asientoNum + '" data-action="ver-asiento" data-num="' + r.asientoNum + '">' + r.asientoNum + '</span>' : '<span class="asiento-pend">—</span>') + '</td>' +
            '<td class="actions-col"><div class="row-actions">' +
              '<button type="button" class="icon-btn" data-action="view" title="Ver imagen" data-id="' + esc(r.id || '') + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
              '<button type="button" class="icon-btn" data-action="edit" title="Editar" data-id="' + esc(r.id || '') + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>' +
              '<button type="button" class="icon-btn danger" data-action="del" title="Eliminar" data-id="' + esc(r.id || '') + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
            '</div></td>' +
            '</tr>';
        }).join('');
      }

      renderPagination(totalItems, totalPages);

      loadAll().then(function (all) {
        var total = all.reduce(function (acc, r) { return acc + (Number(r.total) || 0); }, 0);

        els.statCount.textContent = all.length;
        els.statTotal.textContent = fmtMoney(total);
        els.tableSubtitle.textContent = all.length > 0 ? all.length + ' factura(s) registrada(s).' : 'Sin facturas registradas.';
        els.footerSummary.textContent = totalItems > 0
          ? 'Mostrando ' + (currentPage * PAGE_SIZE + 1) + '–' + Math.min((currentPage + 1) * PAGE_SIZE, totalItems) + ' de ' + all.length + ' facturas · Total general: ' + fmtMoney(total)
          : '';
      });
    });
  }

  function renderPagination(totalItems, totalPages) {
    var container = els.pagination;
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    var prevDisabled = currentPage === 0 ? ' disabled' : '';
    var nextDisabled = currentPage >= totalPages - 1 ? ' disabled' : '';

    var html = '<button type="button" class="page-btn"' + prevDisabled + ' data-page="prev">&laquo;</button>';
    var startPage = Math.max(0, currentPage - 2);
    var endPage = Math.min(totalPages, startPage + 5);
    if (endPage - startPage < 5) startPage = Math.max(0, endPage - 5);

    for (var p = startPage; p < endPage; p++) {
      var active = p === currentPage ? ' active' : '';
      html += '<button type="button" class="page-btn' + active + '" data-page="' + p + '">' + (p + 1) + '</button>';
    }
    html += '<button type="button" class="page-btn"' + nextDisabled + ' data-page="next">&raquo;</button>';
    container.innerHTML = html;
  }

  function refreshAndRender() {
    renderTable();
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------
  // Acciones de fila (ver imagen / eliminar)
  // ---------------------------------------------------------------

  function rowActionHandler(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var action = btn.getAttribute('data-action');

    if (action === 'del') {
      if (!id) return;
      deleteFactura(id).then(function () {
        refreshAndRender();
      }).catch(function (err) {
        showError(err.message || 'Error al eliminar');
      });
    } else if (action === 'view' || action === 'edit') {
      if (!id) return;
      loadAll().then(function (all) {
        var rec = all.filter(function (r) { return String(r.id) === String(id); })[0] || null;
        if (!rec) return;
        if (action === 'view') {
          openImageModal(rec);
        } else {
          loadForEdit(rec);
        }
      });
    } else if (action === 'ver-asiento') {
      var num = btn.getAttribute('data-num');
      if (!num) return;
      // Navegar al tab de Libro Diario
      var ldTab = document.querySelector('[data-tab="libro-diario"]');
      if (ldTab) ldTab.click();
    }
  }

  // ---------------------------------------------------------------
  // Modal de imagen guardada
  // ---------------------------------------------------------------

  function openImageModal(rec) {
    if (!rec.image) return;
    // Crear overlay simple
    var overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.innerHTML = '<div class="modal-box"><div class="modal-header"><h3>Factura ' + esc(rec.numero || '') + '</h3>' +
      '<button type="button" class="btn-icon" data-close="1">&times;</button></div>' +
      '<div class="modal-body"><img src="' + rec.image + '" alt="Factura" style="width:100%;border-radius:10px;"/></div></div>';
    document.body.appendChild(overlay);
    function close() { overlay.remove(); }
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay || ev.target.closest('[data-close]')) close();
    });
  }

  // ---------------------------------------------------------------
  // Editar registro existente
  // ---------------------------------------------------------------

  function loadForEdit(rec) {
    editingId = rec.id;
    els.fNumero.value = rec.numero || '';
    els.fFecha.value = rec.fecha || '';
    els.fNeto.value = rec.neto !== null ? moneyText(rec.neto) : '';
    els.fIva.value = rec.iva !== null ? moneyText(rec.iva) : '';
    els.fTotal.value = rec.total !== null ? moneyText(rec.total) : '';
    els.fDescripcion.value = rec.descripcion || '';
      els.fTipoDoc.value = rec.tipoDocumento || 'Factura';
      els.fTipoOp.value = rec.tipoOperacion || 'Venta';
      els.fCuenta.value = rec.cuentaContable || '';
    if (rec.image) {
      els.previewImg.src = rec.image;
      currentPreview = rec.image;
    }
    els.btnSave.textContent = 'Actualizar factura';
    els.resultSection.hidden = false;
    els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------------------------------------------------------------
  // Cámara con recorte
  // ---------------------------------------------------------------

  var cameraStream = null;
  var cropper = null;
  var cropObjectUrl = null;

  function destroyCropper() {
    if (cropper) {
      try { cropper.destroy(); } catch (e) {}
      cropper = null;
    }
    if (cropObjectUrl) {
      URL.revokeObjectURL(cropObjectUrl);
      cropObjectUrl = null;
    }
    els.cropImage.removeAttribute('src');
  }

  async function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError('La cámara no está disponible en este navegador. Usa el archivo o sirve la app por localhost (HTTPS).');
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 3840 },
          height: { ideal: 2160 }
        },
        audio: false
      });
      els.cameraVideo.srcObject = cameraStream;
      els.cropWrap.hidden = true;
      els.cameraCanvas.hidden = true;
      els.cameraVideo.hidden = false;
      els.btnRetake.hidden = true;
      els.btnCapture.hidden = false;
      els.btnCapture.textContent = 'Tomar foto';
      els.cameraModal.hidden = false;
      await els.cameraVideo.play();
    } catch (err) {
      showError('No se pudo acceder a la cámara: ' + (err && err.message ? err.message : 'error') + '. Verifica los permisos.');
    }
  }

  function closeCamera() {
    stopCameraStream();
    destroyCropper();
    els.cameraModal.hidden = true;
  }

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(function (t) { t.stop(); });
      cameraStream = null;
    }
  }

  function capturePhoto() {
    var video = els.cameraVideo;
    // Captura a resolución completa del sensor (ImageCapture.takePhoto) para
    // máximo detalle OCR. Si no está disponible o falla, se cae al frame del video.
    if (cameraStream && window.ImageCapture) {
      var track = cameraStream.getVideoTracks()[0];
      if (track) {
        var ic = new ImageCapture(track);
        ic.takePhoto().then(function (blob) {
          if (!blob) return;
          stopCameraStream();
          openCropper(blob);
        }).catch(function () {
          captureFromVideo(video);
        });
        return;
      }
    }
    captureFromVideo(video);
  }

  function captureFromVideo(video) {
    var canvas = els.cameraCanvas;
    var w = video.videoWidth;
    var h = video.videoHeight;
    if (!w || !h) return;
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(video, 0, 0, w, h);
    canvas.toBlob(function (blob) {
      if (!blob) return;
      stopCameraStream();
      openCropper(blob);
    }, 'image/jpeg', 0.92);
  }

  // Muestra la foto capturada en el editor de recorte y habilita el botón
  function openCropper(blob) {
    destroyCropper();
    els.cameraStreamHolder = blob;
    cropObjectUrl = URL.createObjectURL(blob);
    var img = els.cropImage;
    img.onload = function () {
      if (typeof Cropper !== 'undefined') {
        cropper = new Cropper(img, {
          aspectRatio: NaN,     // recorte libre
          viewMode: 1,
          autoCropArea: 1,
          background: false,
          movable: true,
          rotatable: false,
          scalable: false,
          zoomable: true
        });
      }
      els.btnCapture.hidden = false;
      els.btnCapture.textContent = 'Recortar y usar';
      els.btnRetake.hidden = false;
    };
    els.cameraVideo.hidden = true;
    els.cameraCanvas.hidden = true;
    els.cropWrap.hidden = false;
    els.btnCapture.hidden = true;
    els.btnRetake.hidden = true;
    img.src = cropObjectUrl;
  }

  // Toma el recorte actual y lo procesa
  function applyCropAndUse() {
    if (!cropper) { useCapturedPhoto(); return; }
    var canvas;
    try {
      canvas = cropper.getCroppedCanvas({
        fillColor: '#112B4A',
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });
    } catch (e) {
      showError('No se pudo aplicar el recorte: ' + e.message);
      return;
    }
    var blob = els.cameraStreamHolder;
    if (!canvas) { useCapturedPhoto(); return; }
    // Mantener buena resolución para el OCR (máx 2600px)
    var MAX = 2600;
    var scale = Math.min(1, MAX / Math.max(canvas.width, canvas.height));
    var raw = canvas;
    if (scale < 1) {
      raw = document.createElement('canvas');
      raw.width = Math.round(canvas.width * scale);
      raw.height = Math.round(canvas.height * scale);
      raw.getContext('2d').drawImage(canvas, 0, 0, raw.width, raw.height);
    }
    // Copia sin realzar (respaldo por si el realce quema texto fino)
    var plain = document.createElement('canvas');
    plain.width = raw.width;
    plain.height = raw.height;
    plain.getContext('2d').drawImage(raw, 0, 0);
    // Copia binarizada (Otsu): rescata texto térmico desvanecido
    var binary = document.createElement('canvas');
    binary.width = raw.width;
    binary.height = raw.height;
    binary.getContext('2d').drawImage(raw, 0, 0);
    binarizeForOCR(binary);
    enhanceForOCR(raw);
    var enhancedBlob = null, plainBlob = null, binaryBlob = null;
    raw.toBlob(function (eb) {
      enhancedBlob = eb;
      plain.toBlob(function (pb) {
        plainBlob = pb;
        binary.toBlob(function (bb) {
          binaryBlob = bb;
          els.cameraStreamHolder = null;
          destroyCropper();
          closeCamera();
          handleImage(enhancedBlob, [plainBlob, binaryBlob]);
        }, 'image/jpeg', 0.95);
      }, 'image/jpeg', 0.95);
    }, 'image/jpeg', 0.95);
  }

  function useCapturedPhoto() {
    var blob = els.cameraStreamHolder;
    if (!blob) return;
    els.cameraStreamHolder = null;
    destroyCropper();
    closeCamera();
    handleImage(blob);
  }

  // ---------------------------------------------------------------
  // Inicialización
  // ---------------------------------------------------------------

  function init() {
    els = {
      fileInput: $('file-input'),
      dropZone: $('drop-zone'),
      btnCamera: $('btn-camera'),
      btnBrowse: $('btn-browse'),
      ocrProgress: $('ocr-progress'),
      progressBar: $('progress-bar'),
      ocrStatus: $('ocr-status'),
      ocrPct: $('ocr-pct'),
      ocrError: $('ocr-error'),
      resultSection: $('result-section'),
      previewImg: $('preview-img'),
      invoiceForm: $('invoice-form'),
      fNumero: $('f-numero'),
      fFecha: $('f-fecha'),
      fNeto: $('f-neto'),
      fIva: $('f-iva'),
      fTotal: $('f-total'),
      fDescripcion: $('f-descripcion'),
      fTipoDoc: $('f-tipo-doc'),
      fTipoOp: $('f-tipo-op'),
      fCuenta: $('f-cuenta'),
      ocrDebug: $('ocr-debug'),
      ocrDebugText: $('ocr-debug-text'),
      btnSave: $('btn-save'),
      btnCancel: $('btn-cancel'),
      searchInput: $('search-input'),
      btnExport: $('btn-export'),
      btnClear: $('btn-clear'),
      tableBody: $('table-body'),
      tableSubtitle: $('table-subtitle'),
      footerSummary: $('footer-summary'),
      statCount: $('stat-count'),
      statTotal: $('stat-total'),
      cameraModal: $('camera-modal'),
      cameraVideo: $('camera-video'),
      cameraCanvas: $('camera-canvas'),
      cropWrap: $('crop-wrap'),
      cropImage: $('crop-image'),
      btnCapture: $('btn-capture'),
      btnRetake: $('btn-retake'),
      btnCancelCamera: $('btn-cancel-camera'),
      btnCloseModal: $('btn-close-modal'),
      confirmModal: $('confirm-modal'),
      btnConfirmClear: $('btn-confirm-clear'),
      filterFechaDesde: $('filter-fecha-desde'),
      filterFechaHasta: $('filter-fecha-hasta'),
      filterTipoDoc: $('filter-tipo-doc'),
      filterTipoOp: $('filter-tipo-op'),
      btnClearFilters: $('btn-clear-filters'),
      pagination: $('pagination'),
      year: $('year'),
      docSelector: $('doc-selector')
    };

    els.year.textContent = new Date().getFullYear();

    // Subida por archivo
    els.btnBrowse.addEventListener('click', function (e) {
      e.stopPropagation();
      els.fileInput.click();
    });
    els.dropZone.addEventListener('click', function () { els.fileInput.click(); });
    els.dropZone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
    });
    els.fileInput.addEventListener('change', function () {
      var file = els.fileInput.files && els.fileInput.files[0];
      if (file) handleFile(file);
      els.fileInput.value = '';
    });

    // Drag & drop
    ['dragenter', 'dragover'].forEach(function (evtName) {
      els.dropZone.addEventListener(evtName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        els.dropZone.classList.add('drag');
      });
    });
    ['dragleave', 'drop'].forEach(function (evtName) {
      els.dropZone.addEventListener(evtName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        els.dropZone.classList.remove('drag');
      });
    });
    els.dropZone.addEventListener('drop', function (e) {
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    });

    // Cámara
    els.btnCamera.addEventListener('click', function (e) { e.stopPropagation(); openCamera(); });
    els.btnCapture.addEventListener('click', function () {
      if (els.cameraStreamHolder) { applyCropAndUse(); }
      else { capturePhoto(); }
    });
    els.btnRetake.addEventListener('click', function () {
      els.cameraStreamHolder = null;
      destroyCropper();
      els.cropWrap.hidden = true;
      els.cameraCanvas.hidden = true;
      els.cameraVideo.hidden = false;
      els.btnCapture.hidden = false;
      els.btnRetake.hidden = true;
      els.btnCapture.textContent = 'Tomar foto';
      openCamera();
    });
    els.btnCancelCamera.addEventListener('click', closeCamera);
    els.btnCloseModal.addEventListener('click', closeCamera);
    els.cameraModal.addEventListener('click', function (e) { if (e.target === els.cameraModal) closeCamera(); });

    // Formulario
    bindMoneyInput(els.fNeto);
    bindMoneyInput(els.fIva);
    bindMoneyInput(els.fTotal);

    els.btnSave.addEventListener('click', saveFromForm);
    els.invoiceForm.addEventListener('submit', function (e) { e.preventDefault(); saveFromForm(); });
    els.btnCancel.addEventListener('click', function () {
      editingId = null;
      els.btnSave.textContent = 'Guardar factura';
      clearResult();
    });

    // Auto-asociar cuenta contable al cambiar descripción
    populateAccountSelect(els.fCuenta);
    els.fDescripcion.addEventListener('input', updateAccountMatch);
    if (els.fTipoOp) els.fTipoOp.addEventListener('change', updateAccountMatch);

    // Tabla
    els.searchInput.addEventListener('input', function () {
      currentSearch = els.searchInput.value.trim();
      currentPage = 0;
      renderTable();
    });
    els.tableBody.addEventListener('click', rowActionHandler);

    // Paginación
    els.pagination.addEventListener('click', function (e) {
      var btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;
      var action = btn.getAttribute('data-page');
      if (action === 'prev') { currentPage--; }
      else if (action === 'next') { currentPage++; }
      else { currentPage = parseInt(action, 10) || 0; }
      renderTable();
    });

    // Filtros
    function applyFilters() { currentPage = 0; renderTable(); }
    els.filterFechaDesde.addEventListener('change', applyFilters);
    els.filterFechaHasta.addEventListener('change', applyFilters);
    els.filterTipoDoc.addEventListener('change', applyFilters);
    els.filterTipoOp.addEventListener('change', applyFilters);
    els.btnClearFilters.addEventListener('click', function () {
      els.filterFechaDesde.value = '';
      els.filterFechaHasta.value = '';
      els.filterTipoDoc.value = '';
      els.filterTipoOp.value = '';
      els.searchInput.value = '';
      currentSearch = '';
      currentPage = 0;
      renderTable();
    });

    // Export / vaciar
    els.btnExport.addEventListener('click', exportCSV);
    els.btnClear.addEventListener('click', function () { els.confirmModal.hidden = false; });
    els.btnConfirmClear.addEventListener('click', function () {
      // Eliminar todas las facturas una por una
      loadAll().then(function (list) {
        var promises = list.map(function (r) {
          return deleteFactura(r.id);
        });
        Promise.all(promises).then(function () {
          els.confirmModal.hidden = true;
          refreshAndRender();
        }).catch(function () {
          els.confirmModal.hidden = true;
          refreshAndRender();
        });
      });
    });
    document.querySelectorAll('.btn-close-confirm').forEach(function (b) {
      b.addEventListener('click', function () { els.confirmModal.hidden = true; });
    });
    els.confirmModal.addEventListener('click', function (e) { if (e.target === els.confirmModal) els.confirmModal.hidden = true; });

    renderTable();
    clearResult();
  }

  // ---------------------------------------------------------------
  // Guardar desde el formulario
  // ---------------------------------------------------------------

  function saveFromForm() {
    var f = {
      numero: els.fNumero.value.trim(),
      fecha: els.fFecha.value.trim(),
      neto: parseMoney(els.fNeto.value),
      iva: parseMoney(els.fIva.value),
      total: parseMoney(els.fTotal.value),
      descripcion: els.fDescripcion.value.trim(),
      tipoDocumento: els.fTipoDoc.value,
      tipoOperacion: els.fTipoOp.value,
      cuentaContable: els.fCuenta.value || ''
    };

    // Si es Compra, negatizar montos
    if (f.tipoOperacion === 'Compra') {
      if (f.neto !== null) f.neto = -Math.abs(f.neto);
      if (f.iva !== null) f.iva = -Math.abs(f.iva);
      if (f.total !== null) f.total = -Math.abs(f.total);
    } else {
      if (f.neto !== null) f.neto = Math.abs(f.neto);
      if (f.iva !== null) f.iva = Math.abs(f.iva);
      if (f.total !== null) f.total = Math.abs(f.total);
    }

    if (!f.numero && !f.fecha && !f.descripcion && f.neto === null) {
      showError('No hay información para guardar. Completa al menos un campo.');
      return;
    }

    if (editingId) {
      f.id = editingId;
      f._editing = true;
      f.image = currentPreview || '';
    } else {
      f.image = currentPreview || '';
    }

    saveFactura(f).then(function (result) {
      var okMsg = editingId ? 'Factura actualizada correctamente.' : 'Factura guardada correctamente.';
      if (result.asiento_num) {
        okMsg += ' Asiento N° ' + result.asiento_num + ' creado en Libro Diario.';
        document.dispatchEvent(new CustomEvent('libro-diario:refresh'));
      }
      var okDiv = document.createElement('div');
      okDiv.className = 'alert alert-success';
      okDiv.textContent = okMsg;
      els.resultSection.parentNode.insertBefore(okDiv, els.resultSection.nextSibling);
      setTimeout(function () { okDiv.remove(); }, 3500);

      editingId = null;
      els.btnSave.textContent = 'Guardar factura';
      clearResult();
      currentPage = 0;
      refreshAndRender();
    }).catch(function (err) {
      showError(err.message || 'Error al guardar');
    });
  }

  // ---------------------------------------------------------------
  // Exportar CSV
  // ---------------------------------------------------------------

  function exportCSV() {
    loadAll().then(function (list) {
      if (list.length === 0) {
        showError('No hay facturas para exportar.');
        return;
      }
      var header = ['numero','fecha','neto','iva','total','descripcion','tipoDocumento','tipoOperacion'];
      var rows = list.map(function (r) {
        return [r.numero || '', r.fecha || '', r.neto || '', r.iva || '', r.total || '', r.descripcion || '', r.tipoDocumento || '', r.tipoOperacion || '']
          .map(function (v) {
            v = String(v == null ? '' : v);
            if (/[",;\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
            return v;
          })
          .join(',');
      });
      var csv = '\uFEFF' + header.join(',') + '\n' + rows.join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'facturas_keysciti_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  if (window.__TEST__) {
    window.__parseInvoice = parseInvoice;
    window.__parseMoney = parseMoney;
    window.__normalizeText = normalizeText;
    window.__findVoucherDescription = findVoucherDescription;
  }
})();