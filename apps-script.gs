
/**
 * BACKEND UNTUK CORO AI PHOTOBOOTH - FULL VERSION
 */

const SCRIPT_PROP = PropertiesService.getScriptProperties();

function getSpreadsheet() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    const ssId = SCRIPT_PROP.getProperty('SPREADSHEET_ID');
    if (ssId) {
      ss = SpreadsheetApp.openById(ssId);
    }
  }
  return ss;
}

function setup() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    ss = SpreadsheetApp.create('Coro AI Photobooth Database');
    SCRIPT_PROP.setProperty('SPREADSHEET_ID', ss.getId());
  }

  // Setup Gallery Sheet
  let gallerySheet = ss.getSheetByName('Gallery');
  if (!gallerySheet) {
    gallerySheet = ss.insertSheet('Gallery');
    gallerySheet.appendRow(['id', 'createdAt', 'conceptName', 'imageUrl', 'downloadUrl', 'token', 'eventId']);
    gallerySheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#f3f3f3");
  }
  
  if (!SCRIPT_PROP.getProperty('ADMIN_PIN')) {
    SCRIPT_PROP.setProperty('ADMIN_PIN', '1234');
  }
  
  return "Setup Berhasil. SS URL: " + ss.getUrl();
}

function doGet(e) {
  const action = e.parameter.action;
  const ss = getSpreadsheet();
  if (!ss) return createJsonResponse({ ok: false, error: 'Spreadsheet not found.' });

  if (action === 'getSettings') {
    // Ambil konsep dari Cloud atau gunakan default jika kosong
    const storedConcepts = SCRIPT_PROP.getProperty('CONCEPTS_JSON');
    
    return createJsonResponse({
      ok: true,
      settings: {
        eventName: SCRIPT_PROP.getProperty('EVENT_NAME') || 'CORO AI PHOTOBOOTH',
        eventDescription: SCRIPT_PROP.getProperty('EVENT_DESC') || 'Transform Your Reality',
        folderId: SCRIPT_PROP.getProperty('FOLDER_ID') || '',
        overlayImage: SCRIPT_PROP.getProperty('OVERLAY_IMAGE') || null,
        backgroundImage: SCRIPT_PROP.getProperty('BACKGROUND_IMAGE') || null,
        adminPin: SCRIPT_PROP.getProperty('ADMIN_PIN') || '1234',
        autoResetTime: parseInt(SCRIPT_PROP.getProperty('AUTO_RESET')) || 60,
        orientation: SCRIPT_PROP.getProperty('ORIENTATION') || 'portrait',
        cameraRotation: parseInt(SCRIPT_PROP.getProperty('CAMERA_ROTATION')) || 0
      },
      concepts: storedConcepts ? JSON.parse(storedConcepts) : null
    });
  }

  if (action === 'gallery') {
    const sheet = ss.getSheetByName('Gallery');
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return createJsonResponse({ items: [] });
    
    const headers = values[0];
    const items = values.slice(1)
      .filter(row => row[0] && row[0].toString().trim() !== "") 
      .map(row => {
        let obj = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      });
      
    return createJsonResponse({ items: items.reverse() });
  }
  
  return createJsonResponse({ ok: true, message: "API Active" });
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return createJsonResponse({ ok: false, error: 'Invalid JSON' });
  }
  
  const action = data.action;
  const ss = getSpreadsheet();
  const gallerySheet = ss.getSheetByName('Gallery');

  if (action === 'uploadGenerated') {
    const folderId = data.folderId || SCRIPT_PROP.getProperty('FOLDER_ID');
    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      folder = DriveApp.getRootFolder();
    }
    
    const timestamp = new Date().toISOString();
    const blob = Utilities.newBlob(Utilities.base64Decode(data.image.split(',')[1]), 'image/png', `PHOTO_${new Date().getTime()}.png`);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const token = Utilities.getUuid();
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1000`;
    const viewUrl = `https://drive.google.com/file/d/${file.getId()}/view`;
    
    gallerySheet.appendRow([file.getId(), timestamp, data.conceptName, thumbnailUrl, viewUrl, token, data.eventId || ""]);
    
    return createJsonResponse({
      ok: true,
      id: file.getId(),
      imageUrl: thumbnailUrl,
      viewUrl: viewUrl,
      downloadUrl: thumbnailUrl
    });
  }

  const adminPin = SCRIPT_PROP.getProperty('ADMIN_PIN') || "1234";
  if (data.pin !== adminPin) return createJsonResponse({ ok: false, error: 'PIN INVALID' });

  if (action === 'updateSettings') {
    const s = data.settings;
    SCRIPT_PROP.setProperty('EVENT_NAME', s.eventName);
    SCRIPT_PROP.setProperty('EVENT_DESC', s.eventDescription);
    SCRIPT_PROP.setProperty('FOLDER_ID', s.folderId);
    SCRIPT_PROP.setProperty('OVERLAY_IMAGE', s.overlayImage || '');
    SCRIPT_PROP.setProperty('BACKGROUND_IMAGE', s.backgroundImage || '');
    SCRIPT_PROP.setProperty('AUTO_RESET', s.autoResetTime.toString());
    SCRIPT_PROP.setProperty('ORIENTATION', s.orientation);
    SCRIPT_PROP.setProperty('CAMERA_ROTATION', s.cameraRotation ? s.cameraRotation.toString() : '0');
    SCRIPT_PROP.setProperty('ADMIN_PIN', s.adminPin);
    return createJsonResponse({ ok: true });
  }

  if (action === 'updateConcepts') {
    SCRIPT_PROP.setProperty('CONCEPTS_JSON', JSON.stringify(data.concepts));
    return createJsonResponse({ ok: true });
  }

  if (action === 'uploadOverlay') {
    const blob = Utilities.newBlob(Utilities.base64Decode(data.image.split(',')[1]), 'image/png', 'overlay.png');
    const folderId = SCRIPT_PROP.getProperty('FOLDER_ID');
    let folder;
    try { folder = DriveApp.getFolderById(folderId); } catch(e) { folder = DriveApp.getRootFolder(); }
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = `https://lh3.googleusercontent.com/d/${file.getId()}`;
    SCRIPT_PROP.setProperty('OVERLAY_IMAGE', url);
    return createJsonResponse({ ok: true, url: url });
  }

  if (action === 'uploadBackground') {
    const blob = Utilities.newBlob(Utilities.base64Decode(data.image.split(',')[1]), 'image/jpeg', 'background.jpg');
    const folderId = SCRIPT_PROP.getProperty('FOLDER_ID');
    let folder;
    try { folder = DriveApp.getFolderById(folderId); } catch(e) { folder = DriveApp.getRootFolder(); }
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = `https://lh3.googleusercontent.com/d/${file.getId()}`;
    SCRIPT_PROP.setProperty('BACKGROUND_IMAGE', url);
    return createJsonResponse({ ok: true, url: url });
  }

  return createJsonResponse({ ok: false, error: 'Action unknown' });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
