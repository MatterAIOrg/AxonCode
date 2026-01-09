// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

package so.matterai.jetbrains.ipc.proxy.interfaces

import so.matterai.jetbrains.editor.DocumentsAndEditorsDelta

interface ExtHostDocumentsAndEditorsProxy {
    fun acceptDocumentsAndEditorsDelta(d: DocumentsAndEditorsDelta)
}
