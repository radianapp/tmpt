export function exportBoardAsJson(board) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(board, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${board.title || 'papan-coretan'}.papan`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportBoardAsExcalidraw(board) {
  const excalidrawFormat = {
    type: "excalidraw",
    version: 2,
    source: "https://tmpt.my.id",
    elements: board.elements.map(el => {
      // Map properties to Excalidraw compatible fields
      return {
        id: el.id,
        type: el.type === 'sticky' ? 'rectangle' : el.type,
        x: el.x - el.width / 2, // Excalidraw uses top-left coordinates
        y: el.y - el.height / 2,
        width: el.width,
        height: el.height,
        angle: el.angle || 0,
        strokeColor: el.strokeColor || "#000000",
        backgroundColor: el.backgroundColor || "transparent",
        fillStyle: el.fillStyle === 'hachure' ? 'hachure' : 'solid',
        strokeWidth: el.strokeWidth || 1,
        strokeStyle: el.strokeStyle || 'solid',
        roughness: el.roughness || 1,
        opacity: el.opacity || 100,
        text: el.text || "",
        fontSize: el.fontSize || 20,
        fontFamily: el.fontFamily === 'hand' ? 1 : 2,
        textAlign: el.textAlign || "center",
        verticalAlign: el.verticalAlign || "middle",
        seed: el.seed || Math.floor(Math.random() * 2147483647),
        version: el.version || 1,
        groupIds: el.groupId ? [el.groupId] : [],
        frameId: el.frameId || null,
        roundness: null,
        isLocked: el.locked || false,
        points: el.points || []
      };
    }),
    appState: {
      viewBackgroundColor: board.appState?.viewBackgroundColor || "#ffffff",
      gridModeEnabled: board.appState?.gridMode || false
    },
    files: {}
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(excalidrawFormat, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${board.title || 'papan-coretan'}.excalidraw`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
