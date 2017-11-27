import * as React from 'react';
import styles from './HelloWorld.module.scss';
import { IHelloWorldProps, IHelloWorldState } from './IHelloWorldProps';
import { escape } from '@microsoft/sp-lodash-subset';

import { Web, setup } from 'sp-pnp-js';
import { proxyUrl, webRelativeUrl } from './../../settings';

export default class HelloWorld extends React.Component<IHelloWorldProps, IHelloWorldState> {

  public web: Web;

  constructor (props: IHelloWorldProps, state: IHelloWorldState) {
    super(props);

    if (props.isLocal) {
      this.web = new Web(`${proxyUrl}${webRelativeUrl}`);
    } else {
      setup({ spfxContext: props.context });
      this.web = new Web(props.context.pageContext.web.absoluteUrl);
    }

    this.state = {
      lists: [],
    };
  }

  public render(): React.ReactElement<IHelloWorldProps> {
    return (
      <div className={ styles.helloWorld }>
        <div className={ styles.container }>
          <div className={ styles.row }>
            <div className={ styles.column }>
              <span className={ styles.title }>Welcome to SharePoint!</span>
              <p className={ styles.subTitle }>Customize SharePoint experiences using Web Parts.</p>
              <p className={ styles.description }>{escape(this.props.description)}</p>
              <a href="https://aka.ms/spfx" className={ styles.button }>
                <span className={ styles.label }>Learn more</span>
              </a>
            </div>
          </div>
          {this.state.lists.length > 0 && (
            <div className={ styles.row }>
              <div className={ styles.column }>
                <ul>
                  {this.state.lists.map(listName => <li>{listName}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  componentDidMount () {
    this.setState({
      lists: ['Loading...']
    });
    this.web.lists.select('Title').orderBy('Title', true).get().then(lists => {
      this.setState({
        lists: lists.map(l => l.Title)
      });
    });
  }

}
