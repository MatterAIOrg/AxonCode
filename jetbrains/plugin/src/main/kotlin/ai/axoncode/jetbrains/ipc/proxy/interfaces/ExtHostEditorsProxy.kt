// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

package so.matterai.jetbrains.ipc.proxy.interfaces

import so.matterai.jetbrains.editor.EditorPropertiesChangeData
import so.matterai.jetbrains.editor.TextEditorDiffInformation

interface ExtHostEditorsProxy {
    fun acceptEditorPropertiesChanged(id: String, props: EditorPropertiesChangeData)
    fun acceptEditorPositionData(data: Map<String, Int>)
    fun acceptEditorDiffInformation(id: String, diffInformation: List<TextEditorDiffInformation>?)
}
