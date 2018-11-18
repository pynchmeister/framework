import { sha256 } from '@0xcert/crypto';
import { Merkle, MerkleHasher } from '@0xcert/merkle';
import { toString, stepPaths, cloneObject, readPath } from '../utils/data';
import { PropProof, PropPath } from './prop';

/**
 * 
 */
export interface CertConfig {
  schema: any;
  hasher?: MerkleHasher;
}

/**
 * 
 */
export class Cert {
  protected schema: any;
  protected merkle: Merkle;

  /**
   * Class constructor.
   * @param merkle Instance of merkle proof.
   */
  public constructor(config: CertConfig) {
    this.schema = config.schema;

    this.merkle = new Merkle({
      hasher: (v) => sha256(toString(v)),
      ...config,
    });
  }

  /**
   * Returns a complete list of proofs for the entiry data object.
   * @param data Complete data object.
   */
  public async notarize(data: any): Promise<PropProof[]> {
    const schemaProps = this.buildSchemaProps(data);
    const compoundProps = await this.buildCompoundProps(schemaProps);
    const schemaProofs = await this.buildProofs(compoundProps);

    return schemaProofs.map((proof) => ({
      path: proof.path,
      nodes: proof.nodes,
      values: proof.values,
    }));
  }

  /**
   * Returns the minimal list of proofs needed to verify the provided data
   * object.
   * @param data Complete data object.
   * @param paths Property paths to be disclosed to a user.
   */
  public async disclose(data: any, paths: PropPath[]): Promise<PropProof[]> {
    const schemaProps = this.buildSchemaProps(data);
    const compoundProps = await this.buildCompoundProps(schemaProps);
    const schemaProofs = await this.buildProofs(compoundProps, paths);

    return schemaProofs.map((proof) => ({
      path: proof.path,
      nodes: proof.nodes,
      values: proof.values,
    }));
  }

  /**
   * Returns `true` when all the property values of the provided `data` are 
   * described with the `proofs`. Note that custom data properties will always
   * be ignored and will thus always pass.
   * @param data Complete data object.
   * @param proofs Data evidence proofs.
   */
  public async calculate(data: any, proofs: PropProof[]): Promise<string> {
    try {
      if (this.checkDataInclusion(data, proofs)) {
        return this.imprintProofs(proofs);
      }
      else {
        return null;
      }
    }
    catch (e) {
      return null;
    }
  }

  /**
   * Calculates merkle tree root node for the provided `data`.
   * @param proofs Data evidence proofs.
   */
  public async imprint(data: any): Promise<string> {
    return this.notarize(data).then((n) => n[0].nodes[0].hash);
  }

  /**
   * Converts data object to a list of property values. The list will include
   * only properties defined by the schema but will not include compound 
   * properties.
   * @param data Arbitrary data object.
   * @param schema Used for recursive processing.
   * @param prepend Used for recursive processing.
   */
  protected buildSchemaProps(data, schema = this.schema, prepend = []) {
    if (schema.type === 'array') {
      return (data || []).map((v, i) => {
        return this.buildSchemaProps(v, schema.items, [...prepend, i]);
      }).reduce((a, b) => a.concat(b), [])
    }
    else if (schema.type === 'object') {
      return Object.keys(schema.properties).sort().map((key) => {
        const prop = this.buildSchemaProps((data || {})[key], schema.properties[key], [...prepend, key]);
        return ['object', 'array'].indexOf(schema.properties[key].type) === -1 ? [prop] : prop;
      }).reduce((a, b) => a.concat(b), [])
    }
    else {
      return {
        path: prepend,
        value: data,
        key: prepend.join('.'),
        group: prepend.slice(0, -1).join('.'),
      };
    }
  }

  /**
   * Upgrades the provided list of data properties with properties of type array
   * and object. These parents have value that equals the root merkle hash of 
   * the subordinated object.
   * @param props Data properties.
   */
  protected async buildCompoundProps(props) {
    props = [...props];

    const groupsByName = this.buildPropGroups(props);
    const groups = Object.keys(groupsByName).sort((a, b) => a > b ? -1 : 1)
      .filter((g) => g !== '');

    for (const group of groups) {
      const path = groupsByName[group];
      const values = [...props.filter((i) => i.group === group)]
        .sort((a, b) => a.key > b.key ? 1 : -1)
        .map((i) => i.value);

      const proofs = await this.merkle.notarize(values);
      props.push({
        path,
        value: proofs.nodes[0].hash,
        key: path.join('.'),
        group: path.slice(0, -1).join('.'),
      });
    }

    return props.sort((a, b) => a.key > b.key ? 1 : -1);
  }

  /**
   * Calculates evidence object for each property and returns a list of proofs.
   * When providing the `paths` only the proofs needed for the required
   * propertoes are included in the result.
   * @param props List of schema properties.
   * @param paths Required propertiy paths.
   */
  protected async buildProofs(props, paths = null) {
    const keys = paths ? stepPaths(paths).map((p) => p.join('.')) : null;

    const groups = {};
    props.forEach((p) => groups[p.group] = p.path.slice(0, -1));
    
    return Promise.all(
      Object.keys(groups).map(async (group) => {
        const values = props.filter((p) => p.group === group).map((p) => p.value);
        
        let evidence = await this.merkle.notarize(values);
        if (keys) {
          const expose = props.filter((p) => p.group === group)
            .map((p, i) => keys.indexOf(p.key) === -1 ? -1 : i)
            .filter((i) => i !== -1);

          evidence = await this.merkle.disclose(evidence, expose);
        } 

        if (!keys || keys.indexOf(groups[group].join('.')) !== -1) {
          return {
            path: groups[group],
            values: evidence.values,
            nodes: evidence.nodes,
            key: groups[group].join('.'),
            group: groups[group].slice(0, -1).join('.'),
          };
        }
      })
    ).then((r) => {
      return r.filter((v) => !!v);
    });
  }

  /**
   * Returns `true` when all the property values of the provided `data` are 
   * described with the `proofs`. Note that custom data properties (including
   * defined fields of undefined value) will always be ignored and will thus
   * always pass.
   * @param data Complete data object.
   * @param proofs Data evidence proofs.
   */
  protected checkDataInclusion(data: any, proofs: PropProof[]): boolean {
    const schemaProps = this.buildSchemaProps(data);

    proofs = cloneObject(proofs).map((p) => ({
      key: p.path.join('.'),
      group: p.path.slice(0, -1).join('.'),
      ...p,
    }));

    for (const prop of schemaProps) {
      const dataValue = readPath(prop.path, data);

      if (typeof dataValue === 'undefined') {
        continue;
      }

      const proofGroup = prop.path.slice(0, -1).join('.');
      const proof = proofs.find((p) => p['key'] === proofGroup);
      if (!proof) {
        return false;
      }

      const dataIndex = this.getPathIndexes(prop.path).pop();
      const proofValue = proof.values.find((v) => v.index === dataIndex);
      if (proofValue.value !== dataValue) {
        return false;
      }
    }

    return true;
  }
  
  /**
   * Calculates merkle tree root node from the provided proofs.
   * @param proofs Data evidence proofs.
   */
  protected async imprintProofs(proofs: PropProof[]): Promise<string> {
    if (proofs.length === 0) {
      return this.getEmptyImprint();
    }

    proofs = cloneObject(proofs).map((prop) => ({
      key: prop.path.join('.'),
      group: prop.path.slice(0, -1).join('.'),
      ...prop,
    })).sort((a, b) => a.path.length > b.path.length ? -1 : 1);

    for (const proof of proofs) {
      const imprint = await this.merkle.imprint(proof).catch(() => '');
      proof.nodes.unshift({
        index: 0,
        hash: imprint,
      });

      const groupKey = proof.path.slice(0, -1).join('.');
      const groupIndex = this.getPathIndexes(proof.path).slice(-1).pop();
      const groupProof = proofs.find((p) => p['key'] === groupKey);
      if (groupProof) {
        groupProof.values.unshift({ // adds posible duplicate thus use `unshift`
          index: groupIndex,
          value: imprint,
        });
      }
    }

    const root = proofs.find((f) => f['key'] === '');
    if (root) {
      return root.nodes.find((n) => n.index === 0).hash;
    }
    else {
      return this.getEmptyImprint();
    }
  }

    /**
   * Returns an index of a property based on the schema object definition.
   * @param path Property path.
   */
  protected getPathIndexes(keys: PropPath): number[] {
    const indexes = [];
    let schema = this.schema;

    for (const key of keys) {
      if (schema.type === 'array') {
        indexes.push(key);
        schema = schema.items;
      }
      else if (schema.type === 'object') {
        indexes.push(
          Object.keys(schema.properties).sort().indexOf(key as string)
        );
        schema = schema.properties[key];
      }
      else {
        indexes.push(undefined);
      }
    }

    return indexes;
  }

  /**
   * 
   */
  protected async getEmptyImprint() {
    return this.merkle.notarize([]).then((e) => e.nodes[0].hash);
  }

  /**
   * Returns a hash of groups where the key represents group name and the value
   * represents group path.
   * @param props List of properties.
   */
  protected buildPropGroups(props) {
    const groups = {};
    
    props.map((p) => {
      let path = [];
      return p.path.map((v) => {
        path.push(v);
        return [...path];
      });
    }).reduce((a, b) => a.concat(b), []).forEach((p) => {
      return groups[p.slice(0, -1).join('.')] = p.slice(0, -1);
    });

    return groups;
  }

}
