## "kilo-code": patch

Attach files pasted or dropped into the chat input

- Pasting a supported file path (absolute, relative to the workspace, or a `file://` URI) into the chat textarea now attaches the file instead of inserting the path as plain text, so the content is actually sent to the LLM.
- Copying a file directly (e.g. from Finder/Explorer) and pasting it now attaches non-image documents (PDF, DOCX, XLSX, CSV, JSON, MD, TXT, TSV) too — previously only image blobs were handled and other files vanished silently.
- Supports images (`.png`, `.jpg`, `.jpeg`, `.webp`) and documents (`.csv`, `.docx`, `.json`, `.md`, `.pdf`, `.txt`, `.text`, `.tsv`, `.xlsx`), reusing the same extraction/size limits and the existing `selectedAttachments` response channel as the attachment picker.
- Refactored `process-attachments.ts` to share the per-file processing logic between the file picker, the pasted-path flow, and the pasted-blob flow.
- Document attachment chips now show the extension-specific material icon (e.g. PDF, Excel, Word) instead of a generic file icon, reusing the same `vscode-material-icons` mapping as mention chips.
- Unified the image and document attachment chips into a single shared flex-wrap container with matching pill styling, so images and files render at the same size and flow together across rows.
- Drag-and-drop now attaches image and document files too: paths dropped from the VS Code explorer are routed to attachments (instead of mentions) when they match a supported type, and non-image file blobs dropped from the OS are processed by the extension. `handleDrop` only intercepts drags that look like file/path drops (external files or path-like text); plain text drags within the editor fall through to native behavior. Drag-and-drop still requires holding Shift because VS Code intercepts native file drags otherwise.
