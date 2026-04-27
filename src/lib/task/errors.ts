export class TaskTerminatedError extends Error {
  constructor(message = 'Task was terminated') {
    super(message)
    this.name = 'TaskTerminatedError'
  }
}
