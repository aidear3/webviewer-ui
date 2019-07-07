import React from 'react';
import { connect } from 'react-redux';
import { translate } from 'react-i18next';
import PropTypes from 'prop-types';

import ActionButton from 'components/ActionButton';

import core from 'core';
import getClassName from 'helpers/getClassName';
import getOverlayPositionBasedOn from 'helpers/getOverlayPositionBasedOn';
import getAnnotationStyles from 'helpers/getAnnotationStyles';
import deepCopyPaths from 'helpers/deepCopyPaths';
import actions from 'actions';
import selectors from 'selectors';

import './SignatureOverlay.scss';

class SignatureOverlay extends React.PureComponent {
  static propTypes = {
    isOpen: PropTypes.bool,
    isDisabled: PropTypes.bool,
    isSignatureModalOpen: PropTypes.bool,
    closeElements: PropTypes.func.isRequired,
    closeElement: PropTypes.func.isRequired,
    openElement: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired
  }

  constructor(props) {
    super(props);
    this.signatureTool = core.getTool('AnnotationCreateSignature');
    this.overlay = React.createRef();
    this.MAX_DEFAULT_SIGNATURES = 2;
    this.currentSignatureIndex = -1;
    this.state = {
      defaultSignatures: [],
      left: 0,
      right: 'auto'
    };
  }

  componentDidMount() {
    this.signatureTool.on('signatureSaved', this.onSignatureSaved);
    // this.signatureTool.on('signatureDeleted', this.onSignatureDeleted);
    core.addEventListener('annotationChanged', this.onAnnotationChanged);
    window.addEventListener('resize', this.handleWindowResize);
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.isOpen && this.props.isOpen) {
      this.props.closeElements([ 'viewControlsOverlay', 'searchOverlay', 'menuOverlay', 'groupOverlay', 'zoomOverlay', 'toolStylePopup' ]);
      this.setOverlayPosition();
    }

    const { freeHandAnnot } = this.signatureTool;
    if (
      prevProps.isOpen && !this.props.isOpen && 
      !this.props.isSignatureModalOpen &&
      freeHandAnnot && !freeHandAnnot.getPaths().length
    ) {
      // location of signatureTool will be set when clicking on a signature widget
      // we want to clear location when the overlay is closed without any default signatures selected
      // to prevent signature from being drawn to the previous location
      // however the overlay will be closed without any default signature selected if we clicked the "add signature" button(which opens the signature modal)
      // we don't want to clear the location in the case because we still want the signature to be automatically added to the widget after the create button is hit in the modal 
      this.signatureTool.clearLocation();
    }
  }

  componentWillUnmount() {
    this.signatureTool.off('signatureSaved', this.onSignatureSaved);
    // this.signatureTool.off('signatureDeleted', this.onSignatureDeleted);
    core.removeEventListener('annotationChanged', this.onAnnotationChanged);
    window.removeEventListener('resize', this.handleWindowResize);
  }

  handleWindowResize = () => {
    this.setOverlayPosition();
  }

  setOverlayPosition = () => {
    const { left, right } = getOverlayPositionBasedOn('signatureToolButton', this.overlay);
    this.setState({ 
      // TODO: remove the hard-coded value. 
      left: left === -9999 ? window.innerWidth / 2 - 95 : left - 95,
      right 
    });
  }

  onSignatureSaved = (e, annotations) => {
    // TODO: change based on length of annotations
    const defaultSignatures = [ ...this.state.defaultSignatures ];
    if (defaultSignatures.length === this.MAX_DEFAULT_SIGNATURES) {
      defaultSignatures.unshift();
    } 

    const savedSignature = {
      imgSrc: this.signatureTool.getPreview(annotations[0]),
      paths: annotations[0].getPaths(),
      styles: getAnnotationStyles(annotations[0])
    };
    defaultSignatures.push(savedSignature);

    this.setState({ defaultSignatures });
  }

  onAnnotationChanged = (e, annotations, action) => {
    if (
      action === 'modify' &&
      annotations.length === 1 && 
      annotations[0].ToolName === 'AnnotationCreateSignature'
    ) {
      const newStyles = getAnnotationStyles(annotations[0]);
      const defaultSignaturesWithNewStyles = this.state.defaultSignatures.map(({ paths }) => {
        this.signatureTool.setSignature(paths, newStyles);

        return {
          imgSrc: this.signatureTool.getPreview(this.signatureTool.annot),
          paths,
          styles: newStyles
        };
      });

      this.setState({ defaultSignatures: defaultSignaturesWithNewStyles });
    }
  }

  setSignature = index => {
    this.currentSignatureIndex = index;

    const { paths, styles } = this.state.defaultSignatures[this.currentSignatureIndex];
    
    core.setToolMode('AnnotationCreateSignature');
    this.signatureTool.setSignature(paths, styles);
    this.props.closeElement('signatureOverlay');

    if (this.signatureTool.hasLocation()) {
      this.signatureTool.addSignature();
    } else {
      this.signatureTool.showPreview();
    }
  }

  deleteDefaultSignature = index => {
    const defaultSignatures = [ ...this.state.defaultSignatures ];
    const isDeletingCurrentSignature = this.currentSignatureIndex === index;

    defaultSignatures.splice(index, 1);
    // TODO: possible improvements if listen to signatureDeleted event.
    this.signatureTool.deleteSavedSignature(index);
    if (isDeletingCurrentSignature) {
      this.signatureTool.annot = null;
      this.signatureTool.hidePreview();
      this.currentSignatureIndex = -1;
    }
    if (!defaultSignatures.length) {
      this.signatureTool.trigger('noDefaultSignatures');
    }

    this.setState({ defaultSignatures });
  }

  openSignatureModal = () => {
    const { defaultSignatures } = this.state;
    const { openElement, closeElement } = this.props;
    
    if (defaultSignatures.length < this.MAX_DEFAULT_SIGNATURES) {
      openElement('signatureModal');
      closeElement('signatureOverlay');
    }
  }

  render() {
    const { left, right, defaultSignatures } = this.state;
    const { t, isDisabled } = this.props;
    const className = getClassName('Overlay SignatureOverlay', this.props);

    if (isDisabled) {
      return null;
    }

    return (
      <div className={className} ref={this.overlay} style={{ left, right }} onClick={e => e.stopPropagation()}>
        <div className="default-signatures-container">
          {defaultSignatures.map(({ imgSrc }, index) => (
            <div className="default-signature" key={index}>
              <div className="signature-image" onClick={() => this.setSignature(index)}>
                <img src={imgSrc} />
              </div>
              <ActionButton dataElement="defaultSignatureDeleteButton" img="ic_delete_black_24px" onClick={() => this.deleteDefaultSignature(index)} />
            </div>
          ))}
          <div 
            className={`add-signature${defaultSignatures.length === this.MAX_DEFAULT_SIGNATURES ? ' disabled' : ' enabled'}`} 
            onClick={this.openSignatureModal}
          >
            {t('option.signatureOverlay.addSignature')}
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  isDisabled: selectors.isElementDisabled(state, 'signatureOverlay'),
  isOpen: selectors.isElementOpen(state, 'signatureOverlay'),
  isSignatureModalOpen: selectors.isElementOpen(state, 'signatureModal')
});

const mapDispatchToProps = {
  closeElements: actions.closeElements,
  closeElement: actions.closeElement,
  openElement: actions.openElement,
};

export default connect(mapStateToProps, mapDispatchToProps)(translate()(SignatureOverlay));