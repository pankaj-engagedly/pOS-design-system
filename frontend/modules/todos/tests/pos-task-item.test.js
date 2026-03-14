import { expect } from '@esm-bundle/chai';
import '../../../shared/molecules/pos-task-item.js';

describe('pos-task-item', () => {
  let el;

  beforeEach(() => {
    el = document.createElement('pos-task-item');
  });

  afterEach(() => {
    el.remove();
  });

  it('renders with title', async () => {
    el.setAttribute('title', 'Buy groceries');
    el.setAttribute('status', 'todo');
    el.setAttribute('priority', 'none');
    document.body.appendChild(el);

    const title = el.shadowRoot.querySelector('.title');
    expect(title).to.not.be.null;
    expect(title.textContent).to.equal('Buy groceries');
  });

  it('shows checked state when done', async () => {
    el.setAttribute('title', 'Done task');
    el.setAttribute('status', 'done');
    el.setAttribute('priority', 'none');
    document.body.appendChild(el);

    const checkbox = el.shadowRoot.querySelector('.checkbox');
    expect(checkbox.classList.contains('checked')).to.be.true;
    expect(el.shadowRoot.querySelector('.title.done')).to.not.be.null;
  });

  it('shows priority badge', async () => {
    el.setAttribute('title', 'High priority');
    el.setAttribute('status', 'todo');
    el.setAttribute('priority', 'high');
    document.body.appendChild(el);

    const badge = el.shadowRoot.querySelector('.priority-badge');
    expect(badge).to.not.be.null;
    expect(badge.textContent).to.equal('high');
  });

  it('dispatches toggle-status on checkbox click', async () => {
    el.setAttribute('title', 'Toggle me');
    el.setAttribute('task-id', '123');
    el.setAttribute('status', 'todo');
    el.setAttribute('priority', 'none');
    document.body.appendChild(el);

    let eventDetail = null;
    el.addEventListener('toggle-status', (e) => {
      eventDetail = e.detail;
    });

    el.shadowRoot.querySelector('.checkbox').click();
    expect(eventDetail).to.not.be.null;
    expect(eventDetail.taskId).to.equal('123');
    expect(eventDetail.done).to.be.true;
  });
});
