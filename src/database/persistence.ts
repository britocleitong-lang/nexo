// Estratégia de armazenamento do Nexo (ver decisão de arquitetura):
//
// 1) OPFS é usado como CACHE rápido, local, pra recarregar o banco
//    instantaneamente quando o app reabre na mesma sessão/dispositivo.
//    OPFS ainda pode ser apagado pelo Safari/iOS em teoria — por isso
//    ele NUNCA é a única cópia.
//
// 2) O BACKUP em arquivo real (.db) é a fonte de verdade de longo prazo:
//    - No Windows/Chrome/Edge: File System Access API, escreve direto
//      num arquivo escolhido pelo usuário (ex: Documentos\Nexo\nexo.db).
//      Isso é um arquivo comum no disco — zero risco de eviction.
//    - No iPhone/Safari (sem suporte a essa API): fallback via download
//      (o arquivo cai no app Arquivos) + import manual via <input type=file>.
//
// O app avisa o usuário se o último backup em arquivo real está "velho".

const OPFS_CACHE_FILENAME = "nexo-cache.db";
const HANDLE_DB_NAME = "nexo-handles";
const LAST_BACKUP_KEY = "nexo:last-backup-at";

// --- Cache OPFS -------------------------------------------------------

async function getOPFSRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!("storage" in navigator) || !navigator.storage.getDirectory) return null;
  try {
    return await navigator.storage.getDirectory();
  } catch {
    return null;
  }
}

export async function cacheToOPFS(bytes: Uint8Array): Promise<void> {
  const root = await getOPFSRoot();
  if (!root) return; // navegador sem suporte a OPFS — segue só com o banco em memória
  try {
    const fileHandle = await root.getFileHandle(OPFS_CACHE_FILENAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(bytes as BufferSource);
    await writable.close();
  } catch (err) {
    console.warn("Falha ao gravar cache OPFS:", err);
  }
}

async function loadFromOPFS(): Promise<Uint8Array | null> {
  const root = await getOPFSRoot();
  if (!root) return null;
  try {
    const fileHandle = await root.getFileHandle(OPFS_CACHE_FILENAME, { create: false });
    const file = await fileHandle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    return null; // ainda não existe cache — primeira execução
  }
}

export async function loadLatestBytes(): Promise<Uint8Array | null> {
  return loadFromOPFS();
}

// --- Guardar/recuperar o handle do arquivo real (Windows) --------------
// Usamos um IndexedDB minúsculo só pra lembrar QUAL arquivo o usuário
// escolheu da última vez, pra não perguntar toda hora.

function openHandleStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("handles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveFileHandle(handle: FileSystemFileHandle): Promise<void> {
  const idb = await openHandleStore();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction("handles", "readwrite");
    tx.objectStore("handles").put(handle, "backup-file");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getSavedFileHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const idb = await openHandleStore();
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get("backup-file");
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

function supportsFileSystemAccess(): boolean {
  return "showSaveFilePicker" in window;
}

// --- Backup em arquivo real ---------------------------------------------

/**
 * Salva o backup como arquivo físico de verdade.
 * Windows/Chrome/Edge: grava direto no arquivo escolhido (pede uma vez só).
 * iPhone/Safari: dispara um download normal, que cai no app Arquivos.
 */
export async function salvarBackupReal(bytes: Uint8Array): Promise<void> {
  if (supportsFileSystemAccess()) {
    let handle = await getSavedFileHandle();

    if (!handle) {
      handle = await (window as any).showSaveFilePicker({
        suggestedName: "nexo.db",
        types: [{ description: "Banco de dados Nexo", accept: { "application/octet-stream": [".db"] } }],
      });
      await saveFileHandle(handle!);
    }

    const writable = await handle!.createWritable();
    await writable.write(bytes as BufferSource);
    await writable.close();
  } else {
    // Fallback iPhone/Safari: download comum
    const blob = new Blob([bytes.slice().buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nexo.db";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
}

/** Restaura o banco a partir de um arquivo .db escolhido pelo usuário. */
export async function abrirBackupReal(): Promise<Uint8Array | null> {
  if (supportsFileSystemAccess()) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: "Banco de dados Nexo", accept: { "application/octet-stream": [".db"] } }],
      });
      const file = await handle.getFile();
      await saveFileHandle(handle);
      return new Uint8Array(await file.arrayBuffer());
    } catch {
      return null; // usuário cancelou
    }
  }

  // Fallback iPhone/Safari: <input type="file"> disparado programaticamente
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".db";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? new Uint8Array(await file.arrayBuffer()) : null);
    };
    input.click();
  });
}

/** Há quantos dias o último backup real foi feito (null = nunca). */
export function diasDesdeUltimoBackup(): number | null {
  const raw = localStorage.getItem(LAST_BACKUP_KEY);
  if (!raw) return null;
  const diffMs = Date.now() - new Date(raw).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
