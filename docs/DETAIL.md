# Permanent Session Delete

This plugin adds **Delete permanently** to the Session context menu. Use it to clean up conversations you no longer need and reclaim the space their session records take on this computer.

## Usage

1. Right-click a conversation in the Session list.
2. Choose **Delete permanently**.
3. Check the conversation title in the confirmation dialog, then choose **Delete permanently**.

Cancel, clicking the backdrop, or pressing `Esc` deletes nothing.

## Deleting a workspace and its folder

The Workspace context menu also has **Delete workspace and folder**:

1. Right-click the workspace name in the sidebar.
2. Choose **Delete workspace and folder**.
3. The confirmation dialog shows the full folder path. Confirming recursively deletes that folder and removes the DSH workspace registration.

This option deletes only the project folder and the workspace registration. It does not automatically delete the conversations recorded in that workspace. The built-in **Delete workspace** action keeps its original behavior and only removes the registration.

## What is deleted

- The conversation's session record, meaning the session log artifact reported by the configured DSH persistence backend;
- When the backend stores one directory per session, that session's own directory (normally containing `session.v4.jsonl.zstd`);
- The session's Workspace membership, archived state, and pin.

## What is not deleted

- The shared attachment cache under `~/.dsh/attachments`. Attachments are content-addressed and may be reused by other sessions, so this plugin never removes them.
- Project files, source code, or documents in your Workspace.
- Other conversations.

## Deleting an open conversation

After confirmation, the plugin first stops the conversation's running work, releases the Host process's writer, and then removes the session files. You do not need to quit or restart DSH. Any generation still in progress is interrupted, and temporary state not yet written to the session log is lost.

If the force-close step fails, the dialog reports that the process could not release the conversation. Retry, or restart DSH and delete it again if the problem persists.

## Safety boundary

The Host accepts only same-origin `POST /api/session-delete` and `POST /api/workspace-delete` requests that pass DSH connection admission (`ctx.connection.requestRejection`) and carry the `x-dsh-session-delete: 1` header.

- For conversations, the path that is actually removed comes from the artifact location reported by `sessionPersistence.stat()`. Only a directory or file whose path matches the session id is accepted.
- For workspaces, the path comes from the Host-side registration looked up by `workspaceId`; client-supplied paths are ignored. Only an absolute, real directory is accepted. Drive roots, the home directory, `~/.dsh` and its descendants, symlinks, and paths containing `..` are refused.

Anything that cannot be attributed safely is rejected.

## Uninstall

Disable or remove `dsh-session-delete` in DSH's plugin manager. Deleted conversations cannot be restored, and uninstalling does not bring them back.
